-- AlterEnum: new desktop layouts that reposition campaign elements
ALTER TYPE "DesignLayout" ADD VALUE 'HERO_TIMER';
ALTER TYPE "DesignLayout" ADD VALUE 'SIDE_RAIL';
ALTER TYPE "DesignLayout" ADD VALUE 'SPREAD';

-- AlterEnum: additional message icons
ALTER TYPE "CampaignDesignIcon" ADD VALUE 'STAR';
ALTER TYPE "CampaignDesignIcon" ADD VALUE 'BOLT';
ALTER TYPE "CampaignDesignIcon" ADD VALUE 'HEART';
ALTER TYPE "CampaignDesignIcon" ADD VALUE 'CART';
ALTER TYPE "CampaignDesignIcon" ADD VALUE 'PERCENT';
ALTER TYPE "CampaignDesignIcon" ADD VALUE 'BELL';
ALTER TYPE "CampaignDesignIcon" ADD VALUE 'ROCKET';
ALTER TYPE "CampaignDesignIcon" ADD VALUE 'CHECK';
