import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";
import { getUserAnalytics } from "~/lib/analytics";

interface UserAnalyticsProps {
  userId: string;
  userName: string;
}

const fetchUserAnalytics = server$(async function(userId: string, days: number = 7) {
  try {
    return await getUserAnalytics(userId, days);
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    return [];
  }
});

export const UserAnalytics = component$<UserAnalyticsProps>(({ userId, userName }) => {
  const analyticsData = useSignal<any[]>([]);
  const isLoading = useSignal(true);
  const isExpanded = useSignal(false);

  useTask$(async ({ track }) => {
    track(() => isExpanded.value);
    
    if (isExpanded.value && analyticsData.value.length === 0) {
      try {
        const data = await fetchUserAnalytics(userId, 7);
        analyticsData.value = data;
      } catch (error) {
        console.error('Error fetching user analytics:', error);
        analyticsData.value = [];
      } finally {
        isLoading.value = false;
      }
    }
  });

  const chartWidth = 80;
  const chartHeight = 24;
  const padding = 2;

  const generateMiniChart = (metric: 'totalViews' | 'uniqueViews' | 'uploadsCount') => {
    if (analyticsData.value.length === 0) return '';
    
    const values = analyticsData.value.map(d => d[metric]);
    const maxValue = Math.max(...values, 1);
    const innerWidth = chartWidth - (padding * 2);
    const innerHeight = chartHeight - (padding * 2);

    const points = analyticsData.value.map((d, index) => {
      const x = padding + (index / (analyticsData.value.length - 1)) * innerWidth;
      const y = padding + (1 - (d[metric] / maxValue)) * innerHeight;
      return `${x},${y}`;
    }).join(' ');

    return points;
  };

  return (
    <details class="mt-3 group" open={isExpanded.value}>
      <summary 
        class="cursor-pointer text-xs text-pink-300 hover:text-pink-200 font-medium flex items-center gap-1"
        onClick$={() => { isExpanded.value = !isExpanded.value; }}
      >
        <span class="group-open:rotate-90 transition-transform">▶</span>
        📊 Analytics for {userName}
      </summary>

      <div class="mt-3 p-3 glass rounded-xl border border-pink-300/20">
        {isLoading.value ? (
          <div class="text-center py-4">
            <div class="animate-spin w-4 h-4 border-2 border-pink-300 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p class="text-pink-200 text-xs">Loading analytics...</p>
          </div>
        ) : analyticsData.value.length > 0 ? (
          <div class="space-y-3">
            {/* Mini Charts */}
            <div class="grid grid-cols-3 gap-2">
              {/* Views Chart */}
              <div class="text-center">
                <div class="text-xs text-pink-300 mb-1">Views</div>
                <svg width={chartWidth} height={chartHeight} class="w-full border border-pink-300/20 rounded bg-black/20">
                  <polyline
                    points={generateMiniChart('totalViews')}
                    fill="none"
                    stroke="#ec4899"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  {analyticsData.value.map((d, index) => {
                    const values = analyticsData.value.map(item => item.totalViews);
                    const maxValue = Math.max(...values, 1);
                    const x = padding + (index / (analyticsData.value.length - 1)) * (chartWidth - padding * 2);
                    const y = padding + (1 - (d.totalViews / maxValue)) * (chartHeight - padding * 2);
                    return (
                      <circle
                        key={index}
                        cx={x}
                        cy={y}
                        r="1"
                        fill="#ec4899"
                      />
                    );
                  })}
                </svg>
                <div class="text-xs text-white font-medium">
                  {analyticsData.value[analyticsData.value.length - 1]?.totalViews || 0}
                </div>
              </div>

              {/* Unique Views Chart */}
              <div class="text-center">
                <div class="text-xs text-pink-300 mb-1">Unique</div>
                <svg width={chartWidth} height={chartHeight} class="w-full border border-pink-300/20 rounded bg-black/20">
                  <polyline
                    points={generateMiniChart('uniqueViews')}
                    fill="none"
                    stroke="#8b5cf6"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  {analyticsData.value.map((d, index) => {
                    const values = analyticsData.value.map(item => item.uniqueViews);
                    const maxValue = Math.max(...values, 1);
                    const x = padding + (index / (analyticsData.value.length - 1)) * (chartWidth - padding * 2);
                    const y = padding + (1 - (d.uniqueViews / maxValue)) * (chartHeight - padding * 2);
                    return (
                      <circle
                        key={index}
                        cx={x}
                        cy={y}
                        r="1"
                        fill="#8b5cf6"
                      />
                    );
                  })}
                </svg>
                <div class="text-xs text-white font-medium">
                  {analyticsData.value[analyticsData.value.length - 1]?.uniqueViews || 0}
                </div>
              </div>

              {/* Uploads Chart */}
              <div class="text-center">
                <div class="text-xs text-pink-300 mb-1">Uploads</div>
                <svg width={chartWidth} height={chartHeight} class="w-full border border-pink-300/20 rounded bg-black/20">
                  <polyline
                    points={generateMiniChart('uploadsCount')}
                    fill="none"
                    stroke="#06b6d4"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  {analyticsData.value.map((d, index) => {
                    const values = analyticsData.value.map(item => item.uploadsCount);
                    const maxValue = Math.max(...values, 1);
                    const x = padding + (index / (analyticsData.value.length - 1)) * (chartWidth - padding * 2);
                    const y = padding + (1 - (d.uploadsCount / maxValue)) * (chartHeight - padding * 2);
                    return (
                      <circle
                        key={index}
                        cx={x}
                        cy={y}
                        r="1"
                        fill="#06b6d4"
                      />
                    );
                  })}
                </svg>
                <div class="text-xs text-white font-medium">
                  {analyticsData.value[analyticsData.value.length - 1]?.uploadsCount || 0}
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div class="border-t border-pink-300/20 pt-2">
              <div class="grid grid-cols-3 gap-2 text-xs">
                <div class="text-center">
                  <div class="text-pink-300">Total (7d)</div>
                  <div class="text-white font-medium">
                    {analyticsData.value.reduce((sum, d) => sum + d.totalViews, 0)} views
                  </div>
                </div>
                <div class="text-center">
                  <div class="text-pink-300">Avg Daily</div>
                  <div class="text-white font-medium">
                    {Math.round(analyticsData.value.reduce((sum, d) => sum + d.totalViews, 0) / 7)} views
                  </div>
                </div>
                <div class="text-center">
                  <div class="text-pink-300">Peak Day</div>
                  <div class="text-white font-medium">
                    {Math.max(...analyticsData.value.map(d => d.totalViews))} views
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div class="text-center py-4">
            <div class="text-pink-300 mb-2">📊</div>
            <p class="text-pink-200 text-xs">No recent activity for {userName}</p>
          </div>
        )}
      </div>
    </details>
  );
});
