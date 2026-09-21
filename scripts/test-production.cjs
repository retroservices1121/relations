// Integration checks with real FFmpeg. Database, storage and paid providers are mocked.
const fs=require('fs');const path=require('path');const os=require('os');const assert=require('node:assert/strict');const ts=require('typescript');const {execFileSync}=require('child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'relations-test-'));
const root=process.cwd();let series={id:'test',format:'narrated',aspectRatio:'16:9',musicMode:'none'};let lines={};let finalBytes;let paidCalls=0;
const episode={id:'custom-test',seriesId:'test',scenes:[{duration:1,narration:'First line'},{duration:1,narration:''}]};
const mocks={
 '@/lib/db':{getCustomEpisode:async()=>episode,getSeries:async()=>series,dbConfigured:()=>true,saveFinalVideo:async()=>{},clearFinalVideo:async()=>{}},
 '@/lib/r2':{r2Configured:()=>true,putR2Object:async(key,bytes)=>{finalBytes=bytes;return {url:'https://test/final',key};}},
 '@/lib/narration':{loadNarration:async()=>lines,saveNarration:async(id,index,item)=>{lines[index]=item;}},
 '@/lib/theme':{ensureHouseholdNonsenseTheme:async()=>{throw Error('Unexpected theme use');}},
};
function load(file){const resolved=path.resolve(root,file);const source=fs.readFileSync(resolved,'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;const module={exports:{}};const req=name=>{if(mocks[name])return mocks[name];if(name.startsWith('@/'))return load(name.slice(2)+'.ts');if(name.startsWith('.'))return load(path.relative(root,path.resolve(path.dirname(resolved),name))+'.ts');return require(name);};new Function('require','module','exports',code)(req,module,module.exports);return module.exports;}
function ff(args){execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);}
function probe(file){return JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_streams','-show_format','-of','json',file]));}
const video=path.join(dir,'video.mp4'),audio=path.join(dir,'audio.mp3'),long=path.join(dir,'long.mp3');
ff(['-f','lavfi','-i','color=c=blue:s=320x180:r=30','-t','1','-c:v','libx264','-pix_fmt','yuv420p',video]);
ff(['-f','lavfi','-i','sine=frequency=440:duration=0.3',audio]);ff(['-f','lavfi','-i','sine=frequency=440:duration=2',long]);
global.fetch=async url=>{if(String(url).includes('api.openai.com')){paidCalls++;return new Response(fs.readFileSync(audio));}return new Response(fs.readFileSync(String(url).includes('voice')?audio:video));};
const req=(body)=>new Request('https://test/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
(async()=>{try{
 const render=load('app/api/render-episode/route.ts');
 const payload={episodeId:episode.id,scenes:[{videoUrl:'https://test/clip',text:'A landscape caption',end:1},{videoUrl:'https://test/clip',text:'Second scene',end:1}]};
 let response=await render.POST(req(payload));assert.equal(response.status,500);assert.match((await response.json()).error,/Generate narration/);
 lines={0:{text:'First line',voice:'onyx',url:'https://test/voice',duration:0.3}};
 response=await render.POST(req(payload));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
 const out=path.join(dir,'final.mp4');fs.writeFileSync(out,finalBytes);let p=probe(out);assert.equal(p.streams.find(s=>s.codec_type==='video').width,1280);assert.equal(p.streams.find(s=>s.codec_type==='video').height,720);assert.ok(p.streams.some(s=>s.codec_type==='audio'));assert.ok(Math.abs(Number(p.format.duration)-2)<0.2);
 const media=load('lib/media.ts');await assert.rejects(()=>media.attachNarration(video,long,path.join(dir,'overflow.mp4'),1),/longer than the video/);
 series={...series,format:'silent',aspectRatio:'9:16'};response=await render.POST(req(payload));assert.equal(response.status,200);fs.writeFileSync(out,finalBytes);p=probe(out);assert.equal(p.streams.find(s=>s.codec_type==='video').width,720);assert.equal(p.streams.find(s=>s.codec_type==='video').height,1280);
 const narration=load('app/api/narration/route.ts');response=await narration.POST(req({episodeId:episode.id,sceneIndex:0,text:'New',voice:'onyx',action:'generate'}));assert.equal(response.status,400);assert.equal(paidCalls,0);
 series={...series,format:'narrated'};response=await narration.POST(req({episodeId:episode.id,sceneIndex:0,text:'Changed',voice:'onyx',action:'save'}));assert.equal(response.status,200);assert.equal(lines[0].url,'');assert.equal(paidCalls,0);
 process.env.OPENAI_API_KEY='mock-only';response=await narration.POST(req({episodeId:episode.id,sceneIndex:0,text:'Changed',voice:'onyx',action:'generate'}));assert.equal(response.status,200);assert.equal(paidCalls,1);assert.ok(lines[0].duration>0);assert.ok(lines[0].url);
 console.log('PASS: landscape captions/export; voiced and silent scene assembly; missing/long narration rejection; portrait regression; protected audio mode; draft invalidation; mocked TTS persistence.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
