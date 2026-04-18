import type { CategoryId } from './types'

interface MerchantEntry {
  patterns: RegExp[]
  category: CategoryId
  name: string
}

export const MERCHANT_DATABASE: MerchantEntry[] = [
  // Groceries
  { patterns: [/WALMART(?!\s*\.COM)/i, /WAL-?MART\s*(?:SUPER|NEIGH)/i], category: 'groceries', name: 'Walmart' },
  { patterns: [/KROGER/i, /FRED\s*MEYER/i, /RALPH'?S/i, /HARRIS\s*TEETER/i, /FRY'?S\s*FOOD/i], category: 'groceries', name: 'Kroger' },
  { patterns: [/COSTCO(?!\s*GAS)/i], category: 'groceries', name: 'Costco' },
  { patterns: [/COSTCO\s*GAS/i], category: 'transportation', name: 'Costco Gas' },
  { patterns: [/TRADER\s*JOE/i, /TJ\s*MAXX/i], category: 'groceries', name: "Trader Joe's" },
  { patterns: [/WHOLE\s*FOODS/i, /WFM/i], category: 'groceries', name: 'Whole Foods' },
  { patterns: [/ALDI/i], category: 'groceries', name: 'Aldi' },
  { patterns: [/PUBLIX/i], category: 'groceries', name: 'Publix' },
  { patterns: [/SAFEWAY/i, /ALBERTSON/i, /VONS/i], category: 'groceries', name: 'Safeway' },
  { patterns: [/H-?E-?B\b/i], category: 'groceries', name: 'H-E-B' },
  { patterns: [/WEGMAN/i], category: 'groceries', name: "Wegmans" },
  { patterns: [/SPROUT/i], category: 'groceries', name: 'Sprouts' },
  { patterns: [/TARGET/i], category: 'shopping', name: 'Target' },
  { patterns: [/SAM'?S\s*CLUB/i], category: 'groceries', name: "Sam's Club" },
  { patterns: [/INSTACART/i], category: 'groceries', name: 'Instacart' },

  // Dining
  { patterns: [/MCDONALD/i, /MCD'?S/i], category: 'dining', name: "McDonald's" },
  { patterns: [/STARBUCK/i, /SBUX/i], category: 'dining', name: 'Starbucks' },
  { patterns: [/CHICK-?FIL-?A/i, /CHIC?K\s*FIL/i], category: 'dining', name: 'Chick-fil-A' },
  { patterns: [/CHIPOTLE/i], category: 'dining', name: 'Chipotle' },
  { patterns: [/TACO\s*BELL/i], category: 'dining', name: 'Taco Bell' },
  { patterns: [/WENDY'?S/i], category: 'dining', name: "Wendy's" },
  { patterns: [/BURGER\s*KING/i], category: 'dining', name: 'Burger King' },
  { patterns: [/PANERA/i], category: 'dining', name: 'Panera' },
  { patterns: [/DUNKIN/i], category: 'dining', name: "Dunkin'" },
  { patterns: [/DOMINO/i], category: 'dining', name: "Domino's" },
  { patterns: [/PIZZA\s*HUT/i], category: 'dining', name: 'Pizza Hut' },
  { patterns: [/PANDA\s*EXPRESS/i], category: 'dining', name: 'Panda Express' },
  { patterns: [/POPEYE/i], category: 'dining', name: "Popeyes" },
  { patterns: [/FIVE\s*GUYS/i], category: 'dining', name: 'Five Guys' },
  { patterns: [/SUBWAY\b/i], category: 'dining', name: 'Subway' },
  { patterns: [/UBER\s*EATS/i], category: 'dining', name: 'Uber Eats' },
  { patterns: [/DOORDASH/i, /DOOR\s*DASH/i], category: 'dining', name: 'DoorDash' },
  { patterns: [/GRUBHUB/i], category: 'dining', name: 'Grubhub' },
  { patterns: [/POSTMATES/i], category: 'dining', name: 'Postmates' },

  // Streaming / Entertainment
  { patterns: [/NETFLIX/i], category: 'subscriptions', name: 'Netflix' },
  { patterns: [/SPOTIFY/i], category: 'subscriptions', name: 'Spotify' },
  { patterns: [/HULU/i], category: 'subscriptions', name: 'Hulu' },
  { patterns: [/DISNEY\s*PLUS/i, /DISNEYPLUS/i], category: 'subscriptions', name: 'Disney+' },
  { patterns: [/HBO\s*MAX/i, /MAX\.COM/i], category: 'subscriptions', name: 'Max' },
  { patterns: [/APPLE\.COM\/BILL/i, /APPLE\s*MUSIC/i, /APPLE\s*TV/i, /ITUNES/i], category: 'subscriptions', name: 'Apple' },
  { patterns: [/YOUTUBE\s*PREM/i, /GOOGLE\s*\*?YOUTUBE/i], category: 'subscriptions', name: 'YouTube Premium' },
  { patterns: [/AMAZON\s*PRIME/i, /AMZN\s*PRIME/i, /PRIME\s*VIDEO/i], category: 'subscriptions', name: 'Amazon Prime' },
  { patterns: [/AUDIBLE/i], category: 'subscriptions', name: 'Audible' },
  { patterns: [/PARAMOUNT/i], category: 'subscriptions', name: 'Paramount+' },
  { patterns: [/PEACOCK/i], category: 'subscriptions', name: 'Peacock' },
  { patterns: [/XBOX/i, /MICROSOFT\s*\*?XBOX/i], category: 'entertainment', name: 'Xbox' },
  { patterns: [/PLAYSTATION/i, /SONY\s*PLAYSTATION/i], category: 'entertainment', name: 'PlayStation' },
  { patterns: [/STEAM\s*GAMES/i, /STEAMPOWERED/i], category: 'entertainment', name: 'Steam' },
  { patterns: [/AMC\s*THEAT/i, /REGAL\s*CINEMA/i, /CINEMARK/i], category: 'entertainment', name: 'Movies' },

  // Shopping
  { patterns: [/AMAZON\.?COM/i, /AMZN/i, /AMZ\*|AMZN\s*MKTP/i], category: 'shopping', name: 'Amazon' },
  { patterns: [/WALMART\.COM/i, /WAL-?MART\.COM/i], category: 'shopping', name: 'Walmart.com' },
  { patterns: [/BEST\s*BUY/i], category: 'shopping', name: 'Best Buy' },
  { patterns: [/HOME\s*DEPOT/i], category: 'shopping', name: 'Home Depot' },
  { patterns: [/LOWE'?S/i], category: 'shopping', name: "Lowe's" },
  { patterns: [/IKEA/i], category: 'shopping', name: 'IKEA' },
  { patterns: [/ETSY/i], category: 'shopping', name: 'Etsy' },
  { patterns: [/EBAY/i], category: 'shopping', name: 'eBay' },

  // Transportation
  { patterns: [/UBER(?!\s*EATS)/i], category: 'transportation', name: 'Uber' },
  { patterns: [/LYFT/i], category: 'transportation', name: 'Lyft' },
  { patterns: [/SHELL\s*(?:OIL|SERVICE)/i, /SHELL\b/i], category: 'transportation', name: 'Shell' },
  { patterns: [/CHEVRON/i], category: 'transportation', name: 'Chevron' },
  { patterns: [/EXXON/i, /MOBIL/i], category: 'transportation', name: 'Exxon' },
  { patterns: [/BP\b|BRITISH\s*PETROL/i], category: 'transportation', name: 'BP' },
  { patterns: [/SUNOCO/i], category: 'transportation', name: 'Sunoco' },
  { patterns: [/WAWA/i], category: 'transportation', name: 'Wawa' },
  { patterns: [/CIRCLE\s*K/i, /KANGAROO/i], category: 'transportation', name: 'Circle K' },
  { patterns: [/PARKING|PKG\s*METER/i], category: 'transportation', name: 'Parking' },
  { patterns: [/TOLL|E-?Z\s*PASS|TURNPIKE/i], category: 'transportation', name: 'Tolls' },

  // Utilities
  { patterns: [/COMCAST|XFINITY/i], category: 'utilities', name: 'Xfinity' },
  { patterns: [/AT&?T|ATT\b/i], category: 'utilities', name: 'AT&T' },
  { patterns: [/VERIZON|VZW/i], category: 'utilities', name: 'Verizon' },
  { patterns: [/T-?MOBILE/i], category: 'utilities', name: 'T-Mobile' },
  { patterns: [/SPRINT/i], category: 'utilities', name: 'Sprint' },
  { patterns: [/SPECTRUM/i], category: 'utilities', name: 'Spectrum' },
  { patterns: [/DUKE\s*ENERGY/i], category: 'utilities', name: 'Duke Energy' },
  { patterns: [/PG&?E|PACIFIC\s*GAS/i], category: 'utilities', name: 'PG&E' },
  { patterns: [/WATER\s*(?:UTIL|DEPT|BILL)/i], category: 'utilities', name: 'Water' },
  { patterns: [/ELECTRIC|POWER\s*CO/i], category: 'utilities', name: 'Electric' },
  { patterns: [/GAS\s*(?:CO|UTIL|BILL)/i], category: 'utilities', name: 'Gas Utility' },
  { patterns: [/GOOGLE\s*FI/i], category: 'utilities', name: 'Google Fi' },

  // Healthcare
  { patterns: [/CVS|CVS\s*PHARM/i], category: 'healthcare', name: 'CVS' },
  { patterns: [/WALGREEN/i], category: 'healthcare', name: 'Walgreens' },
  { patterns: [/RITE\s*AID/i], category: 'healthcare', name: 'Rite Aid' },
  { patterns: [/KAISER/i], category: 'healthcare', name: 'Kaiser' },
  { patterns: [/UNITED\s*HEALTH/i, /UHC/i], category: 'healthcare', name: 'UnitedHealth' },
  { patterns: [/AETNA/i], category: 'healthcare', name: 'Aetna' },
  { patterns: [/BLUE\s*CROSS|BCBS/i], category: 'healthcare', name: 'Blue Cross' },
  { patterns: [/DENTIST|DENTAL/i], category: 'healthcare', name: 'Dental' },
  { patterns: [/DOCTOR|DR\.\s|MEDICAL|CLINIC|HOSPITAL/i], category: 'healthcare', name: 'Medical' },
  { patterns: [/OPTOM|EYE\s*CARE|VISION/i], category: 'healthcare', name: 'Eye Care' },
  { patterns: [/PHARMACY|PHARM/i], category: 'healthcare', name: 'Pharmacy' },

  // Personal Care
  { patterns: [/PLANET\s*FITNESS/i], category: 'personal_care', name: 'Planet Fitness' },
  { patterns: [/EQUINOX/i], category: 'personal_care', name: 'Equinox' },
  { patterns: [/24\s*HOUR\s*FIT/i, /ANYTIME\s*FIT/i, /LA\s*FITNESS/i], category: 'personal_care', name: 'Gym' },
  { patterns: [/ORANGE\s*THEORY/i, /ORANGETHEORY/i], category: 'personal_care', name: 'Orangetheory' },
  { patterns: [/PELOTON/i], category: 'personal_care', name: 'Peloton' },
  { patterns: [/SALON|BARBER|HAIR\s*CUT|GREAT\s*CLIPS|SUPERCUTS/i], category: 'personal_care', name: 'Salon' },
  { patterns: [/SPA|MASSAGE/i], category: 'personal_care', name: 'Spa' },
  { patterns: [/SEPHORA/i], category: 'personal_care', name: 'Sephora' },
  { patterns: [/NORDSTROM/i], category: 'shopping', name: 'Nordstrom' },
  { patterns: [/FIVE\s*BELOW/i], category: 'shopping', name: 'Five Below' },
  { patterns: [/SWEETGREEN/i], category: 'dining', name: 'Sweetgreen' },
  { patterns: [/APPLE\s*STORE/i], category: 'shopping', name: 'Apple Store' },

  // Insurance
  { patterns: [/GEICO/i], category: 'insurance', name: 'GEICO' },
  { patterns: [/STATE\s*FARM/i], category: 'insurance', name: 'State Farm' },
  { patterns: [/ALLSTATE/i], category: 'insurance', name: 'Allstate' },
  { patterns: [/PROGRESSIVE\s*INS/i], category: 'insurance', name: 'Progressive' },
  { patterns: [/USAA/i], category: 'insurance', name: 'USAA' },
  { patterns: [/LIBERTY\s*MUTUAL/i], category: 'insurance', name: 'Liberty Mutual' },

  // Transfers / Payments
  { patterns: [/VENMO/i], category: 'transfer', name: 'Venmo' },
  { patterns: [/ZELLE/i], category: 'transfer', name: 'Zelle' },
  { patterns: [/PAYPAL/i], category: 'transfer', name: 'PayPal' },
  { patterns: [/CASH\s*APP/i, /SQ\s*\*?CASH/i], category: 'transfer', name: 'Cash App' },
  { patterns: [/APPLE\s*CASH/i], category: 'transfer', name: 'Apple Cash' },

  // ATM
  { patterns: [/ATM\s*(?:WITH|W\/D|WITHDR)/i, /CASH\s*WITHDR/i], category: 'atm_cash', name: 'ATM Withdrawal' },

  // Income patterns
  { patterns: [/DIRECT\s*DEP|DIR\s*DEP|PAYROLL/i], category: 'income_salary', name: 'Payroll' },
  { patterns: [/ADP\b|GUSTO|PAYCHEX/i], category: 'income_salary', name: 'Payroll' },
  { patterns: [/INTEREST\s*(?:PAID|EARN|CREDIT|PMT)/i, /INT\s*(?:PAID|EARN)/i], category: 'income_interest', name: 'Interest' },
  { patterns: [/DIVIDEND/i], category: 'income_interest', name: 'Dividend' },
  { patterns: [/REFUND|REBATE|CASHBACK|CASH\s*BACK/i], category: 'income_refund', name: 'Refund' },

  // Fees
  { patterns: [/OVERDRAFT\s*FEE|NSF\s*FEE|INSUFF/i], category: 'fees', name: 'Overdraft Fee' },
  { patterns: [/MONTHLY\s*(?:FEE|MAINT|CHARGE)|SERVICE\s*(?:FEE|CHARGE)/i], category: 'fees', name: 'Bank Fee' },
  { patterns: [/LATE\s*FEE|PENALTY/i], category: 'fees', name: 'Late Fee' },
  { patterns: [/ATM\s*FEE|FOREIGN\s*TRANS/i], category: 'fees', name: 'ATM Fee' },
  { patterns: [/ANNUAL\s*FEE/i], category: 'fees', name: 'Annual Fee' },

  // Additional grocery chains
  { patterns: [/FOOD\s*LION/i], category: 'groceries', name: 'Food Lion' },
  { patterns: [/PIGGLY\s*WIGGLY/i], category: 'groceries', name: 'Piggly Wiggly' },
  { patterns: [/WINCO/i], category: 'groceries', name: 'WinCo' },
  { patterns: [/MEIJER/i], category: 'groceries', name: 'Meijer' },
  { patterns: [/GIANT\s*(EAGLE|FOOD)?/i], category: 'groceries', name: 'Giant' },
  { patterns: [/STOP\s*&?\s*SHOP/i], category: 'groceries', name: 'Stop & Shop' },
  { patterns: [/FOOD\s*4\s*LESS/i], category: 'groceries', name: 'Food 4 Less' },
  { patterns: [/WINN\s*DIXIE/i], category: 'groceries', name: 'Winn-Dixie' },
  { patterns: [/BI-?LO/i], category: 'groceries', name: 'BI-LO' },
  { patterns: [/MARKET\s*BASKET/i], category: 'groceries', name: 'Market Basket' },

  // Additional dining
  { patterns: [/WAFFLE\s*HOUSE/i], category: 'dining', name: 'Waffle House' },
  { patterns: [/CRACKER\s*BARREL/i], category: 'dining', name: 'Cracker Barrel' },
  { patterns: [/OLIVE\s*GARDEN/i], category: 'dining', name: 'Olive Garden' },
  { patterns: [/APPLEBEE/i], category: 'dining', name: "Applebee's" },
  { patterns: [/CHILI'?S/i], category: 'dining', name: "Chili's" },
  { patterns: [/OUTBACK/i], category: 'dining', name: 'Outback' },
  { patterns: [/RED\s*LOBSTER/i], category: 'dining', name: 'Red Lobster' },
  { patterns: [/IHOP/i], category: 'dining', name: 'IHOP' },
  { patterns: [/DENNY'?S/i], category: 'dining', name: "Denny's" },
  { patterns: [/JACK\s*IN\s*THE\s*BOX/i], category: 'dining', name: 'Jack in the Box' },
  { patterns: [/SONIC\s*DR/i], category: 'dining', name: 'Sonic' },
  { patterns: [/ARBY'?S/i], category: 'dining', name: "Arby's" },
  { patterns: [/LITTLE\s*CAESAR/i], category: 'dining', name: "Little Caesars" },
  { patterns: [/PAPA\s*JOHN/i], category: 'dining', name: "Papa John's" },
  { patterns: [/JIMMY\s*JOHN/i], category: 'dining', name: "Jimmy John's" },
  { patterns: [/JERSEY\s*MIKE/i], category: 'dining', name: "Jersey Mike's" },
  { patterns: [/FIREHOUSE\s*SUB/i], category: 'dining', name: 'Firehouse Subs' },
  { patterns: [/WHATABURGER/i], category: 'dining', name: 'Whataburger' },
  { patterns: [/IN-?N-?OUT/i], category: 'dining', name: 'In-N-Out' },
  { patterns: [/SHAKE\s*SHACK/i], category: 'dining', name: 'Shake Shack' },
  { patterns: [/WINGSTOP/i], category: 'dining', name: 'Wingstop' },
  { patterns: [/RAISING\s*CANE/i], category: 'dining', name: "Raising Cane's" },
  { patterns: [/CULVER'?S/i], category: 'dining', name: "Culver's" },
  { patterns: [/ZAXBY/i], category: 'dining', name: "Zaxby's" },

  // Additional shopping
  { patterns: [/DOLLAR\s*(TREE|GENERAL|STORE)/i], category: 'shopping', name: 'Dollar Store' },
  { patterns: [/MARSHALLS/i], category: 'shopping', name: 'Marshalls' },
  { patterns: [/ROSS\s*DRESS/i], category: 'shopping', name: 'Ross' },
  { patterns: [/BURLINGTON/i], category: 'shopping', name: 'Burlington' },
  { patterns: [/OLD\s*NAVY/i], category: 'shopping', name: 'Old Navy' },
  { patterns: [/GAP\b/i], category: 'shopping', name: 'Gap' },
  { patterns: [/H\s*&\s*M\b/i], category: 'shopping', name: 'H&M' },
  { patterns: [/ZARA\b/i], category: 'shopping', name: 'Zara' },
  { patterns: [/NIKE\b/i], category: 'shopping', name: 'Nike' },
  { patterns: [/MACY/i], category: 'shopping', name: "Macy's" },
  { patterns: [/KOHL'?S/i], category: 'shopping', name: "Kohl's" },
  { patterns: [/BED\s*BATH/i], category: 'shopping', name: 'Bed Bath' },
  { patterns: [/HOBBY\s*LOBBY/i], category: 'shopping', name: 'Hobby Lobby' },
  { patterns: [/MICHAEL'?S\s*(CRAFT|STORE)/i], category: 'shopping', name: "Michael's" },
  { patterns: [/COSTCO\.COM/i], category: 'shopping', name: 'Costco.com' },
  { patterns: [/WAYFAIR/i], category: 'shopping', name: 'Wayfair' },
  { patterns: [/OVERSTOCK/i], category: 'shopping', name: 'Overstock' },
  { patterns: [/WISH\.COM/i], category: 'shopping', name: 'Wish' },
  { patterns: [/SHEIN/i], category: 'shopping', name: 'SHEIN' },
  { patterns: [/TEMU/i], category: 'shopping', name: 'Temu' },

  // Additional gas/convenience
  { patterns: [/7-?ELEVEN|7-?11/i], category: 'transportation', name: '7-Eleven' },
  { patterns: [/SHEETZ/i], category: 'transportation', name: 'Sheetz' },
  { patterns: [/QUIKTRIP|QT\b/i], category: 'transportation', name: 'QuikTrip' },
  { patterns: [/PILOT\s*(TRAVEL|FLYING)/i], category: 'transportation', name: 'Pilot' },
  { patterns: [/MURPHY/i], category: 'transportation', name: 'Murphy USA' },
  { patterns: [/SPEEDWAY/i], category: 'transportation', name: 'Speedway' },
  { patterns: [/RACETRAC/i], category: 'transportation', name: 'RaceTrac' },
  { patterns: [/MARATHON\s*(GAS|PETRO)/i], category: 'transportation', name: 'Marathon' },
  { patterns: [/VALERO/i], category: 'transportation', name: 'Valero' },
  { patterns: [/PHILLIPS\s*66/i], category: 'transportation', name: 'Phillips 66' },
  { patterns: [/BUCKY'?S|BUC-?EE/i], category: 'transportation', name: "Buc-ee's" },

  // Auto
  { patterns: [/JIFFY\s*LUBE/i], category: 'auto', name: 'Jiffy Lube' },
  { patterns: [/AUTOZONE|AUTO\s*ZONE/i], category: 'auto', name: 'AutoZone' },
  { patterns: [/O'?\s*REILLY\s*AUTO/i], category: 'auto', name: "O'Reilly Auto" },
  { patterns: [/ADVANCE\s*AUTO/i], category: 'auto', name: 'Advance Auto' },
  { patterns: [/NAPA\s*AUTO/i], category: 'auto', name: 'NAPA' },
  { patterns: [/CARMAX/i], category: 'auto', name: 'CarMax' },
  { patterns: [/DISCOUNT\s*TIRE/i], category: 'auto', name: 'Discount Tire' },
  { patterns: [/GOODYEAR/i], category: 'auto', name: 'Goodyear' },
  { patterns: [/FIRESTONE/i], category: 'auto', name: 'Firestone' },
  { patterns: [/MEINEKE/i], category: 'auto', name: 'Meineke' },
  { patterns: [/MIDAS\b/i], category: 'auto', name: 'Midas' },
  { patterns: [/CAR\s*WASH/i], category: 'auto', name: 'Car Wash' },

  // Additional subscriptions
  { patterns: [/CRUNCHYROLL/i], category: 'subscriptions', name: 'Crunchyroll' },
  { patterns: [/TWITCH/i], category: 'subscriptions', name: 'Twitch' },
  { patterns: [/NOTION/i], category: 'subscriptions', name: 'Notion' },
  { patterns: [/SLACK/i], category: 'subscriptions', name: 'Slack' },
  { patterns: [/ZOOM\s*(US|VIDEO)/i], category: 'subscriptions', name: 'Zoom' },
  { patterns: [/GITHUB/i], category: 'subscriptions', name: 'GitHub' },
  { patterns: [/CANVA/i], category: 'subscriptions', name: 'Canva' },
  { patterns: [/GRAMMARLY/i], category: 'subscriptions', name: 'Grammarly' },
  { patterns: [/HEADSPACE/i], category: 'subscriptions', name: 'Headspace' },
  { patterns: [/CALM\.COM|CALM\s*APP/i], category: 'subscriptions', name: 'Calm' },
  { patterns: [/NORDVPN|EXPRESSVPN|SURFSHARK/i], category: 'subscriptions', name: 'VPN' },
  { patterns: [/TIDAL/i], category: 'subscriptions', name: 'Tidal' },
  { patterns: [/DEEZER/i], category: 'subscriptions', name: 'Deezer' },
  { patterns: [/SIRIUS\s*XM/i], category: 'subscriptions', name: 'SiriusXM' },

  // Travel
  { patterns: [/AIRLINE|UNITED\s*AIR|DELTA\s*AIR|AMERICAN\s*AIR|SOUTHWEST|JETBLUE|SPIRIT\s*AIR|FRONTIER\s*AIR/i], category: 'travel', name: 'Airline' },
  { patterns: [/AIRBNB/i], category: 'travel', name: 'Airbnb' },
  { patterns: [/MARRIOTT|HILTON|HYATT|HOLIDAY\s*INN|HAMPTON/i], category: 'travel', name: 'Hotel' },
  { patterns: [/HERTZ|ENTERPRISE|AVIS|BUDGET\s*RENT|NATIONAL\s*CAR/i], category: 'travel', name: 'Car Rental' },

  // Pets
  { patterns: [/PETCO|PETSMART|PET\s*SUPPLIES/i], category: 'pets', name: 'Pet Store' },
  { patterns: [/VET|VETERINAR|ANIMAL\s*HOSP/i], category: 'pets', name: 'Vet' },
  { patterns: [/CHEWY/i], category: 'pets', name: 'Chewy' },

  // Education
  { patterns: [/TUITION|UNIVERSITY|COLLEGE/i], category: 'education', name: 'Education' },
  { patterns: [/STUDENT\s*LOAN|NAVIENT|NELNET|MOHELA|GREAT\s*LAKES/i], category: 'debt_payment', name: 'Student Loan' },

  // Housing
  { patterns: [/MORTGAGE|HOME\s*LOAN/i], category: 'housing', name: 'Mortgage' },
  { patterns: [/RENT\s*(?:PAY|PMT)|LANDLORD/i], category: 'housing', name: 'Rent' },
  { patterns: [/HOA|HOME\s*OWNER/i], category: 'housing', name: 'HOA' },

  // Subscriptions / Software
  { patterns: [/CHATGPT|OPENAI/i], category: 'subscriptions', name: 'ChatGPT' },
  { patterns: [/CLAUDE|ANTHROPIC/i], category: 'subscriptions', name: 'Claude' },
  { patterns: [/DROPBOX/i], category: 'subscriptions', name: 'Dropbox' },
  { patterns: [/GOOGLE\s*(?:STORAGE|ONE|CLOUD)/i], category: 'subscriptions', name: 'Google' },
  { patterns: [/ICLOUD/i], category: 'subscriptions', name: 'iCloud' },
  { patterns: [/ADOBE/i], category: 'subscriptions', name: 'Adobe' },
  { patterns: [/MICROSOFT\s*(?:365|OFFICE)/i], category: 'subscriptions', name: 'Microsoft 365' },
]

export function matchMerchant(description: string): { category: CategoryId; name: string } | null {
  const upper = description.toUpperCase()
  for (const entry of MERCHANT_DATABASE) {
    for (const pattern of entry.patterns) {
      if (pattern.test(upper)) {
        return { category: entry.category, name: entry.name }
      }
    }
  }
  return null
}
