import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function fetchJobs() {
      setLoading(true);
      setError("");

      try {
        const { data } = await api.get("/jobs", {
          params: {
            q: query || undefined,
            location: location || undefined,
            page: 1,
            limit: 10
          }
        });

        if (active) setJobs(data.jobs);
      } catch {
        if (active) setError("Unable to load jobs.");
      } finally {
        if (active) setLoading(false);
      }
    }

    const timer = setTimeout(fetchJobs, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, location]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">
        Find your next opportunity
      </h1>
      <p className="mb-6 text-gray-500">
        Discover jobs that match your skills.
      </p>

      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <input
          className="rounded-lg border p-3"
          placeholder="Job title or keyword"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <input
          className="rounded-lg border p-3"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      {loading && <p>Loading jobs...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && jobs.length === 0 && (
        <p>No matching jobs found.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {jobs.map((job) => (
          <article key={job._id} className="rounded-xl border p-5">
            <h2 className="text-xl font-semibold">{job.title}</h2>
            <p className="mt-1 text-gray-600">
              {job.company} · {job.location}
            </p>
            <p className="mt-3 text-sm">
              {job.jobType}
            </p>
            <Link
              className="mt-4 inline-block font-semibold text-blue-600"
              to={`/jobs/${job._id}`}
            >
              View details →
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}