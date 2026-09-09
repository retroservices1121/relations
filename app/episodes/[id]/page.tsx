import { notFound } from "next/navigation";
import EpisodeWorkspace from "../../../components/EpisodeWorkspace";
import { episodes as baseEpisodes } from "../../../data/episodes";
import { extraEpisodes } from "../../../data/extraEpisodes";

const episodes = [...baseEpisodes, ...extraEpisodes];

export default async function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const episode = episodes.find((item) => item.id === id);
  if (!episode) notFound();
  return <EpisodeWorkspace episode={episode} />;
}
