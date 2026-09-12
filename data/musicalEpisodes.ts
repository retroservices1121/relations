import type { Episode } from "./episodes";

export type MusicalEpisode = Episode & {
  musical: {
    duration: number;
    prompt: string;
    lyrics: string;
  };
};

export const musicalEpisodes: MusicalEpisode[] = [
  {
    id: "danda-spider-hero",
    title: "She Found a Spider",
    hook: "When your wife needs her hero... but her hero says she can do it",
    musical: {
      duration: 300,
      prompt: "Original fast, funny, upbeat storytelling song for a short relationship cartoon. Energetic male narrator with crisp, playful delivery and clear intelligible lyrics. Around 145 BPM. Bright comedic pop with punchy drums, handclaps, bouncy bass, acoustic guitar, playful plucked synths or mallets, quick stop-start accents and cartoon-comedy musical hits. Keep the groove moving from the first second with almost no intro. Make it catchy, silly, energetic and social-media friendly, with a strong rhythmic pulse and obvious comedic beat changes that can drive visual cuts. Do NOT make it jazzy, swing, lounge, crooner, orchestral, classical, cinematic or slow. No long instrumental breaks. Family-friendly, no profanity, no imitation of any existing song or artist, no copyrighted melody. The singer is an outside narrator; the husband and wife never sing or speak. Perform EVERY lyric through the final words 'the spider's still there too.' Do not stop after 'He gives her a thumbs-up' and do not truncate the outro. After the final sung word, add only a short clean upbeat musical button and end naturally.",
      lyrics: `[intro]\nShe found a spider, now she's frozen in her tracks\n\n[verse]\nShe points across the room like, you better handle that\nShe needs her hero, someone brave to save the day\nHe looks at that little spider and just shrugs the fear away\n\n[chorus]\nGo on, girl, you got this, grab the shoe\nThat tiny bug ain't gonna do a thing to you\nShe takes one step, then the spider takes two\nShe runs behind her husband like, this is YOUR job to do\n\n[outro]\nHe gives her a thumbs-up, like, baby, I believe in you\nSometimes your hero's off duty... and the spider's still there too\n\n[instrumental]`,
    },
    scenes: [
      {
        duration: 5,
        prompt: "EXACTLY TWO RECURRING CHARACTERS MAY APPEAR: one Joe and one Danda. Never duplicate either character. Danda is alone in the foreground of a simple living room when she suddenly notices a SMALL harmless house spider on the floor near the wall. The spider must be clearly visible but not grotesque, giant or scary-looking. Danda freezes instantly, eyes wide, shoulders raised, then backs away several steps while pointing urgently at the spider. Joe is farther back in the room, initially occupied and relaxed, and notices Danda's alarm. Danda is genuinely afraid of spiders. Joe is NOT afraid at all. Both mouths remain fully closed and visually still. No dialogue, lip sync, vocal reactions, screams, gasps or generated music. Sparse literal room/object sounds only. The final musical narration is added later in Studio.",
        caption: "BAD BUG! 😳",
        captionStart: 1.2,
        captionEnd: 4.5,
      },
      {
        duration: 5,
        prompt: "EXACTLY ONE Joe and ONE Danda only. Danda urgently motions Joe over and points repeatedly toward the same small harmless spider, then clasps her hands toward Joe in an exaggerated silent please-save-me pose, clearly wanting her husband to be her hero and kill it. Joe calmly walks over, looks down at the spider with zero fear, then looks back at Danda completely unimpressed by the supposed danger. Joe must never look frightened, startled or hesitant. Danda stays several feet away from the spider. Both mouths fully closed and still. No speech, screams, gasps, lip sync, human vocal sounds or generated music. Final song added later.",
        caption: "Be my hero!",
        captionStart: 0.8,
        captionEnd: 4.3,
      },
      {
        duration: 5,
        prompt: "EXACTLY ONE Joe and ONE Danda only. Joe remains completely calm and unafraid. He looks at the tiny spider, then gives Danda a casual shrug. Joe picks up a nearby shoe or folded paper towel, holds it out to Danda, and points from Danda toward the spider: a crystal-clear silent gesture meaning YOU can kill it. Danda stares at Joe in shocked betrayal, refusing to take the shoe at first. Joe calmly offers it again and gives her an encouraging nod. Joe is not teasing cruelly and is not afraid; he simply believes she can handle the harmless spider herself. Both mouths fully closed and visually still. No dialogue, lip sync, vocalizations or generated music.",
        caption: "You can kill it.",
        captionStart: 1.0,
        captionEnd: 4.5,
      },
      {
        duration: 6,
        prompt: "EXACTLY ONE Joe and ONE Danda only. Danda reluctantly holds the shoe and begins an exaggerated slow approach toward the tiny spider. Her knees bend cautiously and her free hand is held out nervously. Joe stays comfortably several steps behind her, totally relaxed, silently pointing toward the spider and giving an encouraging thumbs-up like a coach. Joe never approaches to kill it and never looks scared. The spider moves only a tiny distance. Danda immediately jumps backward in alarm while Joe remains perfectly calm and simply points to where it moved. Both mouths closed and still. No screams, gasps, speech, lip sync, vocal sounds or generated music.",
        caption: "Husband: moral support only 😂",
        captionStart: 1.0,
        captionEnd: 5.5,
      },
      {
        duration: 6,
        prompt: "EXACTLY ONE Joe and ONE Danda only. The small harmless spider crawls a short distance toward Danda. Danda instantly retreats all the way back to Joe and hides behind his shoulder, still clutching the shoe. Joe remains completely unbothered and looks down toward the spider. In the main visual gag, Joe gently guides Danda from behind him back around to the front, then points toward the spider and gives her another supportive thumbs-up. Danda slowly turns her head toward Joe with an intense closed-mouth look of disbelief and betrayal. Joe gives an innocent encouraging closed-mouth expression. No fear from Joe. No dialogue, screams, gasps, lip sync, vocal sounds or generated music.",
      },
      {
        duration: 5,
        prompt: "EXACTLY ONE Joe and ONE Danda only. Final comedy beat. Danda stands at a cautious distance from the tiny spider holding the shoe up, trying to gather courage. She looks back at Joe one final time, silently pleading for him to take over. Joe is comfortably seated or leaning nearby, completely calm, and gives Danda a big encouraging thumbs-up without moving toward the spider. Danda slowly looks from Joe to the spider and back to Joe, then holds a deeply unimpressed closed-mouth stare. The spider remains harmless and stationary for the final beat. Joe is never afraid. Both mouths remain fully closed and visually still. No dialogue, vocalizations, lip sync or generated music. Hold the final pose for the punchline.",
        caption: "My hero is off duty. 😂",
        captionStart: 1.8,
        captionEnd: 4.8,
      },
    ],
  },
];
