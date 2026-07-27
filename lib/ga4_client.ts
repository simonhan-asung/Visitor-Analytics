import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { google } from "googleapis";

const analyticsDataClient = new BetaAnalyticsDataClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

// GA4 데이터 조회 함수
export async function getGAData(accessToken: string) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + "/api/auth/callback/google"
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    // 실시간 방문자 데이터
    const response = await analyticsDataClient.runReport({
      property: `properties/${process.env.GOOGLE_ANALYTICS_PROPERTY_ID}`,
      dateRanges: [
        {
          startDate: "7daysAgo",
          endDate: "today",
        },
      ],
      dimensions: [
        {
          name: "date",
        },
        {
          name: "deviceCategory",
        },
      ],
      metrics: [
        {
          name: "activeUsers",
        },
        {
          name: "screenPageViews",
        },
        {
          name: "userEngagementDuration",
        },
      ],
    });

    return response;
  } catch (error) {
    console.error("GA4 API Error:", error);
    throw error;
  }
}

// 실시간 활성 사용자
export async function getRealtimeUsers(accessToken: string) {
  try {
    const response = await analyticsDataClient.runRealtimeReport({
      property: `properties/${process.env.GOOGLE_ANALYTICS_PROPERTY_ID}`,
      dimensions: [
        {
          name: "country",
        },
      ],
      metrics: [
        {
          name: "activeUsers",
        },
      ],
    });

    return response;
  } catch (error) {
    console.error("Realtime GA4 API Error:", error);
    throw error;
  }
}
