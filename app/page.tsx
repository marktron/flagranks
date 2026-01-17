import { VotingScreen } from "@/components/voting-screen";
import { generateInitialMatchups } from "@/lib/matchups/generate-initial";

// ISR: Regenerate page every 60 seconds
export const revalidate = 60;

export default async function Home() {
  const initialMatchups = await generateInitialMatchups(10);

  return (
    <div className="py-8 sm:py-12 md:py-16">
      <VotingScreen initialMatchups={initialMatchups} />
    </div>
  );
}
