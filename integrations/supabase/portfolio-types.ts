export interface PortfolioItem {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  duration?: number;
  created_at?: string;
}
