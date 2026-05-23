import { useEffect, useState } from 'react';
import axios from '../../api/axios';

export default function SearchAnalytics() {
  const [analytics, setAnalytics] = useState({ topSearches: [], noResultSearches: [], topClickedProducts: [] });
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchAnalytics = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await axios.get('/search/admin/analytics', {
          params: {
            days,
            limit: 20
          }
        });

        if (!cancelled) {
          setAnalytics(response.data);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.response?.data?.error?.message || 'Unable to load search analytics.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchAnalytics();

    return () => {
      cancelled = true;
    };
  }, [days]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Search Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Track demand signals, failed searches, and catalog gaps.</p>
        </div>

        <label className="text-sm font-medium text-gray-700">
          Window
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="ml-2 rounded-md border border-gray-300 px-3 py-2"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-80 animate-pulse rounded-lg bg-white shadow-sm" />
          <div className="h-80 animate-pulse rounded-lg bg-white shadow-sm" />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <AnalyticsTable
            title="Top Searches"
            emptyText="No search data yet."
            rows={analytics.topSearches}
            columns={[
              { key: 'query', label: 'Query' },
              { key: 'count', label: 'Searches' },
              { key: 'averageResultCount', label: 'Avg. Results' }
            ]}
          />

          <AnalyticsTable
            title="No-Result Searches"
            emptyText="No failed searches in this window."
            rows={analytics.noResultSearches}
            columns={[
              { key: 'query', label: 'Query' },
              { key: 'count', label: 'Searches' }
            ]}
          />

          <AnalyticsTable
            title="Most Clicked Products"
            emptyText="No product clicks tracked yet."
            rows={analytics.topClickedProducts}
            columns={[
              { key: 'productName', label: 'Product' },
              { key: 'count', label: 'Clicks' }
            ]}
          />
        </div>
      )}
    </div>
  );
}

function AnalyticsTable({ title, emptyText, rows, columns }) {
  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-sm text-gray-500">{emptyText}</p>
      ) : (
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.query} className="border-t border-gray-100">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-gray-700">{row[column.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
