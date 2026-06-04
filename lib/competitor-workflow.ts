export function shouldFetchBeforeCompetitorAnalysis(input: {
  competitors: string[];
  libraryUrls: string[];
  fetchedAdCount: number;
}) {
  return input.fetchedAdCount === 0 && (input.competitors.length > 0 || input.libraryUrls.length > 0);
}
