export interface PortfolioItem {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  width?: number;
  height?: number;
  duration?: number;
  created_at?: string;
}
