export type ChoiceQuestion = { id: string; prompt: string; options: string[]; multiple?: boolean };

const sharedWhatDoYouWant = [
  "Paid projects",
  "Exposure and portfolio growth",
  "Creative collabs",
  "Mentorship or learning",
  "Build long-term industry relationships",
];

const sharedWhatMattersMost = [
  "Trust and clear communication",
  "Fair pay or value exchange",
  "Strong creative vision / aesthetic fit",
  "Professionalism and dependability",
  "Potential exposure or audience growth",
  "Long-term potential to build together",
];

const sharedFollowerRanges = ["<1k", "1–5k", "5–25k", "25–100k", "100k+"];

export const roleQuestions: Record<string, ChoiceQuestion[]> = {
  model: [
    { id: "shoot_types", prompt: "What types of shoots do you focus on?", options: ["Streetwear campaigns", "Editorial / magazine work", "Commercial / e-commerce", "Music / culture collaborations"], multiple: true },
    { id: "showcase_where", prompt: "Where do you showcase most of your work?", options: ["Instagram", "TikTok", "Portfolio / website"], multiple: true },
    { id: "connect_with", prompt: "Who are you most interested in connecting with?", options: ["Photographers", "Creative directors", "Clothing brands / designers", "Stylists", "Content creators"], multiple: true },
    { id: "audience_size", prompt: "Roughly how many followers / audience reach do you have?", options: sharedFollowerRanges },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  photographer: [
    { id: "primarily_shoot", prompt: "What do you primarily shoot?", options: ["Street/editorial fashion", "Sneakers / products", "Lifestyle / culture", "Artists / events"], multiple: true },
    { id: "aesthetic", prompt: "How would you describe your aesthetic?", options: ["Raw and street-focused", "Clean and luxury-inspired", "Experimental / artistic", "Documentary-style realism"], multiple: true },
    { id: "connect_with", prompt: "Who would you like to connect with most?", options: ["Models", "Designers / brands", "Videographers", "Content creators", "Stylists"], multiple: true },
    { id: "projects_per_month", prompt: "Average number of projects per month?", options: ["0–2", "3–5", "6–10", "10+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  videographer: [
    { id: "video_work", prompt: "What type of video work do you create most often?", options: ["Fashion films", "Sneaker or brand promos", "Music x fashion collaborations", "Behind-the-scenes / culture docs"], multiple: true },
    { id: "approach", prompt: "What best describes your approach?", options: ["Cinematic and polished", "Raw handheld", "Fast-cut, short-form edits", "Artistic / experimental"], multiple: true },
    { id: "prefer_collab", prompt: "Who do you prefer collaborating with?", options: ["Photographers", "Clothing brands", "Models", "Creative directors", "Content creators"], multiple: true },
    { id: "monthly_output", prompt: "Average monthly content output?", options: ["<5 videos", "5–15 videos", "15–30 videos", "30+ videos"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  content_creator: [
    { id: "content_kind", prompt: "What kind of content do you create most?", options: ["Styling / GRWM videos", "Fashion x lifestyle storytelling", "Brand collaborations", "Culture commentary"], multiple: true },
    { id: "audience_strongest", prompt: "Where is your audience strongest?", options: ["TikTok", "Instagram", "YouTube", "Multi-platform"] },
    { id: "collab_with", prompt: "Who do you want to collaborate with here?", options: ["Clothing brands", "Photographers / videographers", "Stylists", "Other creators", "Models"], multiple: true },
    { id: "follower_range", prompt: "Follower range / audience size?", options: ["<1k", "1–10k", "10–50k", "50–200k", "200k+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  stylist: [
    { id: "style_for", prompt: "You mainly style for…", options: ["Editorial shoots", "Artists / music videos", "Personal clients", "Events / live culture moments"], multiple: true },
    { id: "approach", prompt: "How would you describe your approach?", options: ["Streetwear layering", "Luxury streetwear", "Bold / experimental", "Archive + contemporary mix"], multiple: true },
    { id: "top_collaborators", prompt: "Who are your top collaborators?", options: ["Models", "Designers", "Photographers", "Brands", "Content creators"], multiple: true },
    { id: "projects_per_month", prompt: "Average projects styled per month?", options: ["0–2", "3–5", "6–10", "10+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  designer: [
    { id: "design_focus", prompt: "Your design focus is…", options: ["Streetwear-focused", "Archive-inspired / vintage revivals", "Sustainable / upcycled", "Luxury street", "Experimental / avant-garde", "Minimalist / refined", "Gender-fluid / unisex"], multiple: true },
    { id: "release_where", prompt: "Where do you release?", options: ["Instagram drops", "TikTok previews", "Online shop / Shopify", "In-person pop-ups", "Wholesale / stockists"], multiple: true },
    { id: "ideal_collaborators", prompt: "Who are your ideal collaborators?", options: ["Models", "Photographers", "Stylists", "Creative directors", "Other designers", "Brands"], multiple: true },
    { id: "pieces_per_year", prompt: "How many pieces or collections do you produce per year?", options: ["1–2", "3–5", "6–10", "10+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  creative_director: [
    { id: "direct_mainly", prompt: "You mainly direct…", options: ["Campaigns for streetwear brands", "Content teams / fashion shoots", "Music x culture projects", "Concept / visual development"], multiple: true },
    { id: "strongest_contrib", prompt: "What is your strongest contribution?", options: ["Vision + brand storytelling", "Team leadership", "Moodboarding / trend direction", "Brand positioning"] },
    { id: "partnerships_prioritize", prompt: "What types of partnerships do you prioritize?", options: ["Leading full creative teams", "Co-developing with brands", "Conceptual collaborations", "Mentorship / talent development"], multiple: true },
    { id: "team_size", prompt: "Approximate team size you manage or lead?", options: ["Solo / 1–2", "Small team (3–5)", "Medium team (6–10)", "Large team (10+)"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  clothing_brand: [
    { id: "what_make", prompt: "What do you make or sell?", options: ["Retail / pop-ups", "Lifestyle fashion", "Wholesale / distribution", "Online-only drops"], multiple: true },
    { id: "who_need", prompt: "Who do you need to work with?", options: ["Photographers", "Videographers", "Models", "Designers", "Stylists", "Marketing / promotion partners", "Other brands"], multiple: true },
    { id: "most_help_with", prompt: "What do you most need help with?", options: ["Shoots (photo / video)", "Brand collaborations", "Marketing / promotion", "Talent relationships"], multiple: true },
    { id: "monthly_output", prompt: "Estimated monthly projects or content output?", options: ["0–2", "3–5", "6–10", "10+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  agency: [
    { id: "specialize_in", prompt: "What does your agency specialize in?", options: ["Talent management (models, creators, stylists)", "Creative production (shoots, campaigns, content)", "Brand strategy / marketing", "Full-service fashion / lifestyle agency"], multiple: true },
    { id: "typical_clients", prompt: "Who are your typical clients?", options: ["Emerging streetwear brands", "Established fashion / luxury brands", "Artists / musicians / culture collaborators", "Lifestyle / wellness brands"], multiple: true },
    { id: "work_with_most", prompt: "What types of creatives do you work with most?", options: ["Models", "Photographers / videographers", "Content creators / influencers", "Stylists", "Designers"], multiple: true },
    { id: "monthly_projects", prompt: "Average monthly projects?", options: ["0–5", "6–15", "16–30", "30+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  photography_business: [
    { id: "business_offer", prompt: "What does your business offer?", options: ["Studio rental / production space", "Photography / videography services", "Full creative production support", "Event or pop-up shoots"], multiple: true },
    { id: "primarily_serve", prompt: "Who do you primarily serve?", options: ["Clothing brands", "Agencies", "Models / creatives", "Publications / media", "Other businesses"], multiple: true },
    { id: "open_collaborations", prompt: "What types of collaborations are you open to?", options: ["Studio partnerships", "Freelance creative hires", "Brand shoots", "Long-term creative partnerships"], multiple: true },
    { id: "shoots_per_month", prompt: "Average shoots per month?", options: ["0–5", "6–15", "16–30", "30+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  publisher: [
    { id: "publication_kind", prompt: "What kind of publication do you run?", options: ["Print magazine / publication", "Digital / online publication", "Hybrid print + digital"] },
    { id: "editorial_focus", prompt: "What is your main editorial focus?", options: ["Streetwear / sneaker culture", "Broader fashion / lifestyle", "Music x fashion / culture", "Art / creative industries"], multiple: true },
    { id: "publish_how_often", prompt: "How often do you publish?", options: ["Monthly", "Bi-monthly / seasonal", "Quarterly", "Ongoing / digital-first"] },
    { id: "feature_collab_with", prompt: "Who do you typically feature or collaborate with?", options: ["Photographers", "Models", "Brands", "Designers", "Creative directors", "Writers / journalists"], multiple: true },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
  other_business: [
    { id: "business_desc", prompt: "What best describes your business?", options: ["Manufacturing / production", "Distribution / wholesale", "Services (creative, marketing, etc.)", "E-commerce / retail", "Events / experiences"], multiple: true },
    { id: "need_connect_with", prompt: "Who do you need to connect with?", options: ["Brands", "Designers", "Creatives (photo/video)", "Models", "Publications", "Other businesses"], multiple: true },
    { id: "primary_goals", prompt: "What are your primary business goals?", options: ["Grow partnerships", "Expand client base", "Develop new projects", "Long-term collaborations"], multiple: true },
    { id: "projects_per_month", prompt: "Average projects or partnerships per month?", options: ["0–2", "3–5", "6–10", "10+"] },
    { id: "what_you_want", prompt: "What do you want most from your connections here?", options: sharedWhatDoYouWant, multiple: true },
    { id: "what_matters_most", prompt: "What matters most to you when choosing who to collaborate with?", options: sharedWhatMattersMost, multiple: true },
  ],
};

export const creativeRoles = ["model", "photographer", "videographer", "content_creator", "stylist", "designer", "creative_director"] as const;
export const businessRoles = ["clothing_brand", "agency", "photography_business", "publisher", "other_business"] as const;
