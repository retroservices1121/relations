import { notFound } from "next/navigation";
import EpisodeWorkspace from "../../../components/EpisodeWorkspace";
import MusicalProductionWorkspace from "../../../components/MusicalProductionWorkspace";
import FalCostDashboard from "../../../components/FalCostDashboard";
import { episodes as baseEpisodes } from "../../../data/episodes";
import type { Episode } from "../../../data/episodes";
import { extraEpisodes } from "../../../data/extraEpisodes";
import { musicalEpisodes } from "../../../data/musicalEpisodes";
import { episodeOverrides } from "../../../data/episodeOverrides";
import { newEpisodes } from "../../../data/newEpisodes";
import { dbConfigured, getCustomEpisode, getSeries } from "../../../lib/db";
import { householdNonsenseSeries } from "../../../lib/series";
import styles from "./episode.module.css";

const episodes: Episode[] = [
  ...baseEpisodes.map((episode) => episodeOverrides[episode.id] ?? episode),
  ...extraEpisodes,
  ...newEpisodes,
  ...musicalEpisodes,
];

export const dynamic = "force-dynamic";

export default async function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let episode: Episode | undefined = episodes.find((item) => item.id === id);

  if (!episode && id.startsWith("custom-") && dbConfigured()) {
    try {
      const customEpisode = await getCustomEpisode(id);
      episode = customEpisode ?? undefined;
    } catch {
      episode = undefined;
    }
  }

  if (!episode) notFound();

  const series = episode.seriesId && dbConfigured()
    ? await getSeries(episode.seriesId).catch(() => null)
    : householdNonsenseSeries;

  const musical = musicalEpisodes.find((item) => item.id === id);

  return (
    <div className={styles.shell}>
      {musical ? <MusicalProductionWorkspace episode={musical} /> : <EpisodeWorkspace episode={episode} series={series || householdNonsenseSeries} />}
      <FalCostDashboard episodeId={episode.id} />
    </div>
  );
}
