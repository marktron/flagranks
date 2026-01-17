import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trophy, TrendingUp, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UN_MEMBER_FLAGS } from "@/lib/db/seed-data";
import { getFlagByIso2, getFlagRank } from "@/lib/db";

interface PageProps {
  params: Promise<{ iso2: string }>;
}

// Generate static paths for all 193 flags
export function generateStaticParams() {
  return UN_MEMBER_FLAGS.map((flag) => ({
    iso2: flag.iso2,
  }));
}

// Generate dynamic metadata for each flag page
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { iso2 } = await params;
  const flagData = UN_MEMBER_FLAGS.find(
    (f) => f.iso2.toLowerCase() === iso2.toLowerCase()
  );

  if (!flagData) {
    return { title: "Flag Not Found | FlagRanks" };
  }

  const title = `${flagData.country_name} Flag Design Ranking | FlagRanks`;
  const description = `See how the ${flagData.country_name} flag ranks in our global flag design voting. Compare with other national flags and vote on your favorites.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://flagranks.com/flags/${iso2.toLowerCase()}`,
      images: [
        {
          url: `/flags/${iso2.toLowerCase()}.svg`,
          width: 640,
          height: 480,
          alt: `Flag of ${flagData.country_name}`,
        },
      ],
    },
    twitter: {
      title,
      description,
      images: [`/flags/${iso2.toLowerCase()}.svg`],
    },
    alternates: {
      canonical: `https://flagranks.com/flags/${iso2.toLowerCase()}`,
    },
  };
}

export default async function FlagPage({ params }: PageProps) {
  const { iso2 } = await params;

  // Find basic flag data from seed
  const flagData = UN_MEMBER_FLAGS.find(
    (f) => f.iso2.toLowerCase() === iso2.toLowerCase()
  );

  if (!flagData) {
    notFound();
  }

  // Try to fetch live stats from database
  let flag = null;
  let rank = null;

  try {
    flag = await getFlagByIso2(iso2);
    if (flag) {
      rank = await getFlagRank(flag.id);
    }
  } catch {
    // Database not available (local dev) - show page without stats
  }

  const hasStats = flag && flag.games > 0;

  return (
    <div className="py-8 sm:py-12 max-w-4xl mx-auto px-4">
      {/* Back navigation */}
      <div className="mb-6">
        <Button variant="ghost" asChild className="gap-2">
          <Link href="/leaderboard">
            <ArrowLeft className="w-4 h-4" />
            Back to Leaderboard
          </Link>
        </Button>
      </div>

      {/* Flag hero section */}
      <div className="sticker-card sticker-card-static p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center sm:items-start">
          {/* Flag image */}
          <div className="w-48 h-32 sm:w-64 sm:h-44 relative rounded-lg shadow-lg overflow-hidden border-2 border-ink/10 flex-shrink-0">
            <Image
              src={`/flags/${iso2.toLowerCase()}.svg`}
              alt={`Flag of ${flagData.country_name}`}
              fill
              className="object-cover saturate-[1.2]"
              priority
            />
          </div>

          {/* Flag info */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">
              {flagData.country_name}
            </h1>
            <p className="text-ink-light mb-4">
              ISO Code: <span className="font-mono font-bold">{iso2.toUpperCase()}</span>
            </p>

            {/* Stats */}
            {hasStats ? (
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="text-center p-3 rounded-lg bg-paper-dark/30">
                  <div className="flex items-center justify-center gap-1 text-pop mb-1">
                    <Trophy className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Rank</span>
                  </div>
                  <div className="text-2xl font-bold">#{rank}</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-paper-dark/30">
                  <div className="flex items-center justify-center gap-1 text-pop mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Score</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {(flag!.smoothed_score * 100).toFixed(1)}
                  </div>
                </div>
                <div className="text-center p-3 rounded-lg bg-paper-dark/30">
                  <div className="flex items-center justify-center gap-1 text-pop mb-1">
                    <Gamepad2 className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Games</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {flag!.games.toLocaleString()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 p-4 rounded-lg bg-paper-dark/30 text-center">
                <p className="text-ink-light">
                  {process.env.NODE_ENV === "development"
                    ? "Stats unavailable in local development"
                    : "No voting data yet for this flag"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Win/Loss breakdown */}
      {hasStats && (
        <div className="sticker-card sticker-card-static p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Performance</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-3xl font-bold text-green-600">
                {flag!.wins.toLocaleString()}
              </div>
              <div className="text-sm text-ink-light">Wins</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="text-3xl font-bold text-red-600">
                {flag!.losses.toLocaleString()}
              </div>
              <div className="text-sm text-ink-light">Losses</div>
            </div>
          </div>
          <div className="mt-4 text-center text-sm text-ink-light">
            Win Rate: <span className="font-bold">{flag!.raw_win_pct}%</span>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="text-center">
        <p className="text-ink-light mb-4">
          Think {flagData.country_name} deserves a higher rank?
        </p>
        <Button asChild size="lg">
          <Link href="/">Vote Now</Link>
        </Button>
      </div>

      {/* JSON-LD for this flag */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Country",
            name: flagData.country_name,
            identifier: iso2.toUpperCase(),
            image: `https://flagranks.com/flags/${iso2.toLowerCase()}.svg`,
            url: `https://flagranks.com/flags/${iso2.toLowerCase()}`,
          }),
        }}
      />
    </div>
  );
}
