"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Release {
  version: string;
  target: string;
  arch: string;
  format: string;
  publishDate: string;
}

export default function AdminPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReleases() {
      try {
        const response = await fetch("/api/admin/releases");
        if (!response.ok) {
          throw new Error("Failed to fetch releases");
        }

        const data = await response.json();
        setReleases(data.releases);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchReleases();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Release Server Admin</h1>

      {loading && <p>Loading releases...</p>}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      {!loading && !error && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Available Releases</h2>

          {releases.length === 0 ? (
            <p>No releases found.</p>
          ) : (
            <table className="min-w-full bg-white border border-gray-200">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">Version</th>
                  <th className="py-2 px-4 border-b">Target</th>
                  <th className="py-2 px-4 border-b">Architecture</th>
                  <th className="py-2 px-4 border-b">Format</th>
                  <th className="py-2 px-4 border-b">Published</th>
                  <th className="py-2 px-4 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((release, index) => (
                  <tr
                    key={index}
                    className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}
                  >
                    <td className="py-2 px-4 border-b">{release.version}</td>
                    <td className="py-2 px-4 border-b">{release.target}</td>
                    <td className="py-2 px-4 border-b">{release.arch}</td>
                    <td className="py-2 px-4 border-b">{release.format}</td>
                    <td className="py-2 px-4 border-b">
                      {new Date(release.publishDate).toLocaleString()}
                    </td>
                    <td className="py-2 px-4 border-b">
                      <Link
                        href={`/api/download/desktop/alpha/${release.target}/${release.arch}/${release.format}/${release.version}`}
                        className="text-blue-500 hover:text-blue-700 mr-2"
                      >
                        Download
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
