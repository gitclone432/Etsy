/**
 * Central Page Registry — single source of truth for all admin pages.
 * Each page has:
 *   id          — unique key (matches backend PAGE_DEFAULT_ROLES)
 *   name        — display label in sidebar
 *   path        — frontend route (relative to /admin)
 *   category    — sidebar group key
 *   defaultRoles — roles with access by default (backward compat)
 *   component   — lazy import path (used in AdminLayout for dynamic routing)
 */

// Categories for sidebar grouping
export const PAGE_CATEGORIES = {
  storeListings: { id: 'storeListings', name: 'Store Listings', icon: 'Inventory2Icon' },
  orderFulfilment: { id: 'orderFulfilment', name: 'Order Fulfilment', icon: 'LocalShippingIcon' },
  compatibility: { id: 'compatibility', name: 'Compatibility', icon: 'TaskIcon' },
  listingResearch: { id: 'listingResearch', name: 'Product Listings', icon: 'ListAltIcon' },
  compliance: { id: 'compliance', name: 'Compliance & Support', icon: 'AdminPanelSettingsIcon' },
  ebayParams: { id: 'ebayParams', name: 'eBay Parameters', icon: 'StoreIcon' },
  others: { id: 'others', name: 'Others', icon: 'AppsIcon' },
  etsy: { id: 'etsy', name: 'ETSY', icon: 'StorefrontIcon' },
  ebayBuying: { id: 'ebayBuying', name: 'eBay Buying', icon: 'ShoppingCartIcon' },
  settingsSection: { id: 'settingsSection', name: 'Settings', icon: 'SettingsIcon' },
};

// Submenu definitions
export const SUBMENUS = {
  templateListing: {
    id: 'templateListing',
    name: 'Template Listing',
    category: 'listingResearch',
    pages: ['ManageTemplates', 'AsinSourcing', 'SourcingRules', 'SelectSellerLab', 'AmazonSearch', 'AsinPrecheck', 'AsinPrecheckStats', 'AsinPrecheckExclusions', 'AmazonPiSourceColumns', 'ListingsDatabase', 'ListingDirectory', 'TemplateDirectory'],
  },
  asinImporter: {
    id: 'asinImporter',
    name: 'ASIN Importer',
    category: 'listingResearch',
    pages: ['AsinDirectory', 'AsinLists'],
  },
};

export const PAGE_REGISTRY = [
  // ====== STORE LISTINGS ======
  { id: 'StoreListings', name: 'Store Listings', path: '/store-listings', category: 'storeListings', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'ListingRecommendations', name: 'Listing Recommendations', path: '/listing-recommendations', category: 'storeListings', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'SendOfferEligible', name: 'Send Offer Eligible', path: '/send-offer-eligible', category: 'storeListings', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'NegotiatedPricePolicies', name: 'Negotiated Price Policies', path: '/negotiated-price-policies', category: 'storeListings', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'SellingSummary', name: 'Selling Summary', path: '/selling-summary', category: 'storeListings', defaultRoles: ['superadmin', 'listingadmin'] },

  // ====== ORDER FULFILMENT ======
  { id: 'OrdersDashboard', name: 'Orders Dashboard', path: '/orders-dashboard', category: 'orderFulfilment', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'OrderAnalytics', name: 'Order Analytics', path: '/order-analytics', category: 'orderFulfilment', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'LegacyItemAnalytics', name: 'Legacy Item Analytics', path: '/legacy-item-analytics', category: 'orderFulfilment', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'CRPAnalytics', name: 'CRP Analytics', path: '/crp-analytics', category: 'orderFulfilment', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'CRPComparison', name: 'CRP Comparison', path: '/crp-comparison', category: 'orderFulfilment', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'Fulfillment', name: 'All Orders (Fulfilment)', path: '/fulfillment', category: 'orderFulfilment', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'AwaitingShipment', name: 'Awaiting Shipment', path: '/awaiting-shipment', category: 'orderFulfilment', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'AwaitingSheet', name: 'Awaiting Sheet', path: '/awaiting-sheet', category: 'orderFulfilment', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'AmazonArrivals', name: 'Amazon Arrivals', path: '/amazon-arrivals', category: 'orderFulfilment', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'FulfillmentNotes', name: 'Fulfillment Notes', path: '/fulfillment-notes', category: 'orderFulfilment', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },

  // ====== COMPATIBILITY ======
  { id: 'CompatibilityDashboard', name: 'Compatibility Dashboard', path: '/compatibility-dashboard', category: 'compatibility', defaultRoles: ['superadmin', 'compatibilityadmin', 'compatibilityeditor'] },
  { id: 'CompatibilityTasks', name: 'Compatibility Tasks', path: '/compatibility-tasks', category: 'compatibility', defaultRoles: ['superadmin', 'compatibilityadmin'] },
  { id: 'CompatibilityProgress', name: 'Progress Tracking', path: '/compatibility-progress', category: 'compatibility', defaultRoles: ['superadmin', 'compatibilityadmin'] },
  { id: 'AiFitmentUsage', name: 'AI Fitment Usage', path: '/ai-fitment-usage', category: 'compatibility', defaultRoles: ['superadmin', 'compatibilityadmin'] },
  { id: 'ListingStats', name: 'Listing Statistics', path: '/listing-stats', category: 'compatibility', defaultRoles: ['superadmin', 'compatibilityadmin'] },
  { id: 'CompatibilityBatchHistory', name: 'Batch History', path: '/compatibility-batch-history', category: 'compatibility', defaultRoles: ['superadmin', 'compatibilityadmin', 'compatibilityeditor'] },
  { id: 'AutoCompatibility', name: 'Auto Compatibility', path: '/auto-compatibility', category: 'compatibility', defaultRoles: ['superadmin', 'compatibilityadmin'] },
  { id: 'AutoCompatSellerHistory', name: 'Auto Compat Seller History', path: '/auto-compat-seller-history', category: 'compatibility', defaultRoles: ['superadmin', 'compatibilityadmin'] },
  { id: 'AutoCompatReviewHistory', name: 'Review History', path: '/auto-compat-review-history', category: 'compatibility', defaultRoles: ['superadmin', 'compatibilityadmin'] },
  { id: 'EditListings', name: 'Edit Listings', path: '/edit-listings', category: 'compatibility', defaultRoles: ['superadmin', 'compatibilityadmin', 'compatibilityeditor'] },
  { id: 'CompatibilityEditor', name: 'My Assignments', path: '/compatibility-editor', category: 'compatibility', defaultRoles: ['superadmin', 'compatibilityeditor'] },
  { id: 'AddCompatibilityEditor', name: 'Add Compatibility Editor', path: '/add-compatibility-editor', category: 'compatibility', defaultRoles: ['superadmin', 'compatibilityadmin'] },

  // ====== LISTING & RESEARCH ======
  // Template Listing submenu
  { id: 'ManageTemplates', name: 'Manage Templates', path: '/manage-templates', category: 'listingResearch', submenu: 'templateListing', defaultRoles: ['superadmin'] },
  { id: 'AsinSourcing', name: 'ASIN Sourcing', path: '/asin-sourcing', category: 'listingResearch', submenu: 'templateListing', defaultRoles: ['superadmin', 'lister', 'advancelister'] },
  { id: 'SourcingRules', name: 'Sourcing Rules', path: '/sourcing-rules', category: 'listingResearch', submenu: 'templateListing', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'AmazonPiSourceColumns', name: 'Amazon Product Info Columns', path: '/amazon-product-info-columns', category: 'listingResearch', submenu: 'templateListing', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'ListingsDatabase', name: 'Listings Database', path: '/listings-database', category: 'listingResearch', submenu: 'templateListing', defaultRoles: ['superadmin'] },
  { id: 'SelectSellerLab', name: 'CSV Listings', path: '/select-seller-lab', category: 'listingResearch', submenu: 'templateListing', defaultRoles: ['superadmin', 'lister', 'advancelister', 'trainee'] },
  { id: 'AmazonSearch', name: 'Amazon Search', path: '/amazon-search', category: 'listingResearch', submenu: 'templateListing', defaultRoles: ['superadmin', 'listingadmin', 'lister', 'advancelister', 'trainee'] },
  { id: 'AsinPrecheck', name: 'ASIN Precheck', path: '/asin-precheck', category: 'listingResearch', submenu: 'templateListing', defaultRoles: ['superadmin', 'lister', 'advancelister', 'trainee'] },
  { id: 'AsinPrecheckExclusions', name: 'Precheck Exclusions', path: '/asin-precheck-exclusions', category: 'listingResearch', submenu: 'templateListing', defaultRoles: ['superadmin', 'lister', 'advancelister', 'trainee'] },
  { id: 'AsinPrecheckStats', name: 'ASIN Precheck Stats', path: '/asin-precheck-stats', category: 'listingResearch', submenu: 'templateListing', defaultRoles: ['superadmin'] },
  { id: 'AsinPrecheckExclusions', name: 'Precheck Exclusions', path: '/asin-precheck-exclusions', category: 'listingResearch', submenu: 'templateListing', defaultRoles: ['superadmin', 'lister', 'advancelister', 'trainee'] },
  { id: 'PrecheckAiUsage', name: 'Precheck AI Usage', path: '/precheck-ai-usage', category: 'listingResearch', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'AiListingUsage', name: 'AI Listing Usage', path: '/ai-listing-usage', category: 'listingResearch', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'DailyListingComparison', name: 'Daily Listing Comparison', path: '/daily-listing-comparison', category: 'listingResearch', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'ManualEndListing', name: 'Manual End Listing', path: '/manual-end-listing', category: 'listingResearch', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'SkuSellerOrderProfit', name: 'SKU Seller Profit', path: '/sku-seller-profit', category: 'listingResearch', defaultRoles: ['superadmin', 'listingadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'ListingDirectory', name: 'Listing Directory', path: '/listing-directory', category: 'listingResearch', submenu: 'templateListing', defaultRoles: ['superadmin', 'lister', 'advancelister', 'trainee'] },
  { id: 'TemplateDirectory', name: 'Template Directory', path: '/template-directory', category: 'listingResearch', submenu: 'templateListing', defaultRoles: ['superadmin', 'lister', 'advancelister', 'trainee'] },
  // ASIN Importer submenu
  { id: 'AsinDirectory', name: 'ASIN Directory', path: '/asin-directory', category: 'listingResearch', submenu: 'asinImporter', defaultRoles: ['superadmin', 'productadmin'] },
  { id: 'AsinLists', name: 'ASIN Lists', path: '/asin-lists', category: 'listingResearch', submenu: 'asinImporter', defaultRoles: ['superadmin', 'productadmin'] },
  // Direct items
  { id: 'FeedUpload', name: 'Feed Upload (CSV)', path: '/feed-upload', category: 'listingResearch', defaultRoles: ['superadmin', 'listingadmin', 'lister'] },
  { id: 'DirectList', name: 'Direct List to eBay', path: '/direct-list', category: 'listingResearch', defaultRoles: ['superadmin', 'listingadmin', 'lister'] },
  { id: 'FeedUploadStats', name: 'Feed Upload Stats', path: '/feed-upload-stats', category: 'listingResearch', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'SellerUploadLimits', name: 'Seller Upload Limits', path: '/seller-upload-limits', category: 'listingResearch', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'CsvStorage', name: 'CSV Storage', path: '/csv-storage', category: 'listingResearch', defaultRoles: ['superadmin', 'listingadmin', 'lister'] },
  { id: 'UserCategoryTargets', name: 'User Category Targets', path: '/user-category-targets', category: 'listingResearch', defaultRoles: ['superadmin', 'hradmin', 'hr'] },
  { id: 'UserListingPerformance', name: 'Listing Performance', path: '/user-listing-performance', category: 'listingResearch', defaultRoles: ['superadmin', 'hradmin', 'hr'] },

  // ====== COMPLIANCE & SUPPORT ======
  { id: 'ComplianceBoard', name: 'Compliance Board', path: '/compliance-board', category: 'compliance', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'ComplianceMonitoring', name: 'Compliance Monitoring', path: '/compliance-monitoring', category: 'compliance', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'Disputes', name: 'Issues and Resolutions', path: '/disputes', category: 'compliance', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'AccountHealth', name: 'Account Health Report', path: '/account-health', category: 'compliance', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'BuyerMessages', name: 'Buyer Messages', path: '/message-received', category: 'compliance', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'ConversationManagement', name: 'Conversation Mgmt', path: '/conversation-management', category: 'compliance', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'AmazonAccounts', name: 'Supplier Accounts', path: '/amazon-accounts', category: 'settingsSection', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'ExcludeOrderQtySkips', name: 'Exclude <$3', path: '/exclude-order-qty-skips', category: 'settingsSection', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'CronJobs', name: 'Cron Jobs', path: '/cron-jobs', category: 'settingsSection', defaultRoles: ['superadmin'] },
  { id: 'InfraUsage', name: 'Infra Usage', path: '/infra-usage', category: 'settingsSection', defaultRoles: ['superadmin'] },
  { id: 'ScraperTester', name: 'Scraper Tester', path: '/scraper-tester', category: 'settingsSection', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'ImageOverlaySettings', name: 'Image Overlay', path: '/image-overlay', category: 'settingsSection', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'GmailTester', name: 'Gmail Tester', path: '/gmail-tester', category: 'settingsSection', defaultRoles: ['superadmin'] },
  { id: 'Authenticator', name: 'Authenticator', path: '/authenticator', category: 'settingsSection', defaultRoles: ['superadmin', 'listingadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },
  { id: 'AffiliateOrders', name: 'Affiliate Orders', path: '/affiliate-orders', category: 'compliance', defaultRoles: ['superadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },

  // ====== EBAY PARAMETERS ======
  { id: 'StoreOverview', name: 'Store Limits', path: '/store-overview', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'EbayApiUsage', name: 'eBay API Usage', path: '/ebay-api-usage', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'EbayAnalyticsHub', name: 'Analytics Hub', path: '/analytics-hub', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'EbayFeedback', name: 'Feedback', path: '/feedback', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'EbayApiTester', name: 'eBay API Tester', path: '/ebay-api-tester', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'EbayInventoryManager', name: 'Inventory Manager', path: '/ebay-inventory', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'SkuIndexSync', name: 'SKU Index Sync', path: '/sku-index-sync', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'DuplicateSkus', name: 'Duplicate SKUs', path: '/duplicate-skus', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'SkuIndexDashboard', name: 'SKU Index Dashboard', path: '/sku-index-dashboard', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'AmazonStockCheck', name: 'Amazon Stock Check', path: '/amazon-stock-check', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'SellerSkuStockCheck', name: 'Seller SKU Stock Check', path: '/seller-sku-stock-check', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'AmazonStockCheckExcludedBrands', name: 'Stock Check Excluded Brands', path: '/amazon-stock-check-excluded-brands', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'ActiveListingTiers', name: 'Active Listing Tiers', path: '/active-listing-tiers', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'ExpiringListings', name: 'Expiring Listings', path: '/expiring-listings', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'EndListingStats', name: 'End Listing Stats', path: '/end-listing-stats', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'EndListingByDate', name: 'End Listing By Date', path: '/end-listing-by-date', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'AdsAndMarketing', name: 'Ads and Marketing', path: '/ads-and-marketing', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'SellerFunds', name: 'Seller Funds', path: '/seller-funds', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'FinancesTransactionSummary', name: 'Transaction Summary', path: '/finances/transaction-summary', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'FinancesTransactions', name: 'Finances Transactions', path: '/finances/transactions', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'FinancesPayoutGroups', name: 'Finances by Payout', path: '/finances/transactions-by-payout', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'Discounts', name: 'Discounts', path: '/discounts', category: 'ebayParams', defaultRoles: ['superadmin', 'listingadmin', 'fulfillmentadmin', 'hoc', 'compliancemanager'] },

  // ====== OTHERS ======
  { id: 'ManageCategories', name: 'Manage Categories', path: '/categories', category: 'others', defaultRoles: ['superadmin', 'productadmin'] },
  { id: 'ManagePlatforms', name: 'Manage Platforms', path: '/platforms', category: 'others', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'ManageStores', name: 'Manage Stores', path: '/stores', category: 'others', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'ProductTable', name: 'Product Table', path: '/listing', category: 'others', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'ManageRanges', name: 'Manage Ranges', path: '/ranges', category: 'others', defaultRoles: ['superadmin', 'productadmin'] },
  { id: 'UserPerformance', name: 'User Performance Logs', path: '/user-performance', category: 'others', defaultRoles: ['superadmin'] },

  // ====== ETSY ======
  { id: 'EtsyDashboard', name: 'Dashboard', path: '/etsy/dashboard', category: 'etsy', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'EtsyProducts', name: 'Products', path: '/etsy/products', category: 'etsy', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'EtsyOrderFulfilment', name: 'Order Fulfilment', path: '/etsy/order-fulfilment', category: 'etsy', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'EtsyTracking', name: 'Tracking', path: '/etsy/tracking', category: 'etsy', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'EtsyProfitSheet', name: 'Profit Sheet', path: '/etsy/profit-sheet', category: 'etsy', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'EtsyOrderAnalytics', name: 'Etsy Order Analytics', path: '/etsy/order-analytics', category: 'etsy', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'EtsyDailyOrders', name: 'Daily Orders', path: '/etsy/daily-orders', category: 'etsy', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'AsinRefine', name: 'ASIN Refine', path: '/etsy/asin-refine', category: 'etsy', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'EtsyApiConnect', name: 'Store Management', path: '/etsy/connect-stores', category: 'etsy', defaultRoles: ['superadmin', 'listingadmin'] },

  // ====== EBAY BUYING ======
  { id: 'EbayBuyingAccounts', name: 'Buying Accounts', path: '/ebay-buying/accounts', category: 'ebayBuying', defaultRoles: ['superadmin'] },
  { id: 'EbayBuyingLab', name: 'Place Orders', path: '/ebay-buying', category: 'ebayBuying', defaultRoles: ['superadmin'] },

  // ====== SETTINGS ======
  { id: 'StoresPage', name: 'eBay Stores', path: '/stores-page', category: 'settingsSection', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'EtsyStoresPage', name: 'Etsy Stores', path: '/etsy-stores', category: 'settingsSection', defaultRoles: ['superadmin', 'listingadmin'] },
  { id: 'DescriptionTemplates', name: 'Description Templates', path: '/description-templates', category: 'settingsSection', defaultRoles: ['superadmin', 'listingadmin'] },
];

// Helper: get page by ID
export const getPageById = (id) => PAGE_REGISTRY.find(p => p.id === id);

// Helper: get all pages by category
export const getPagesByCategory = (category) => PAGE_REGISTRY.filter(p => p.category === category);

// Helper: get all category IDs
export const getCategoryIds = () => Object.keys(PAGE_CATEGORIES);
