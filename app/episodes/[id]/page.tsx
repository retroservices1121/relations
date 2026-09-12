import { notFound } from "next/navigation";
import EpisodeWorkspace from "../../../components/EpisodeWorkspace";
import FalCostDashboard from "../../../components/FalCostDashboard";
import MusicalEpisodePanel from "../../../components/MusicalEpisodePanel";
import { episodes as baseEpisodes } from "../../../data/episodes";
import { extraEpisodes } from "../../../data/extraEpisodes";
import { musicalEpisodes } from "../../../data/musicalEpisodes";

const episodes = [...baseEpisodes, ...extraEpisodes, ...musicalEpisodes];

export default async function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const episode = episodes.find((item) => item.id === id);
  if (!episode) notFound();
  const musical = musicalEpisodes.find((item) => item.id === id);
  return <>
    <EpisodeWorkspace episode={episode} />
    {musical && <MusicalEpisodePanel episode={musical} />}
    <FalCostDashboard episodeId={episode.id} />
  </>;
}
