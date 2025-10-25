export interface PortfolioItem {
  id: string;
  user_id: string;
  title?: string;
  description?: string;
  media_url: string;
  media_type: 'image' | 'video';
  thumbnail_url?: string;
  width?: number;
  height?: number;
  tags?: string[];
  created_at: string;
  updated_at?: string;
}

export interface PortfolioItemWithProfile extends PortfolioItem {
  profiles?: {
    user_id: string;
    full_name?: string;
    username?: string;
    profile_picture?: string;
  };
}
