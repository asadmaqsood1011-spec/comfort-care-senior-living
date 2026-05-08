document.documentElement.classList.add("js");

const communities = [
  {
    name: "August Haus Comfort Care",
    city: "Gaylord",
    address: "1201 Village Pkwy, Gaylord, MI 49735, United States",
    phone: "(989) 448-7094",
    image: "/assets/communities/august-haus.jpg",
    careOptions: ["Assisted Living", "Memory Care", "Independent Living"],
    description: "A caring Gaylord community where quality of life is treated as seriously as quality of care, with a safe, enjoyable setting for worry-free senior living.",
    highlights: ["Spa & salon", "Cinema", "Shopping trips", "Personal assistance", "Chef-prepared meals", "24/7 Housekeeping"]
  },
  {
    name: "Bavarian Comfort Care",
    city: "Bridgeport",
    address: "5366 W Rolling Hills Dr, Bridgeport Charter Township, MI 48722",
    phone: "(989) 777-7776",
    image: "/assets/communities/bavarian.jpg",
    careOptions: ["Assisted Living", "Memory Care", "MemoryVille", "Independent Living"],
    description: "The original Bavarian Comfort Care community set the tone for Comfort Care's blend of luxury, comfort, manicured grounds, and peaceful courtyards.",
    highlights: ["Spa & salon", "Cinema", "Shopping trips", "Personal assistance", "Outdoor activities", "24/7 Housekeeping"]
  },
  {
    name: "Bay City Comfort Care",
    city: "Bay City",
    address: "4130 Shrestha Dr, Bay City, MI 48706, United States",
    phone: "(989) 545-6000",
    image: "/assets/communities/bay-city.jpg",
    careOptions: ["Assisted Living", "Memory Care", "MemoryVille", "Independent Living"],
    description: "A state-of-the-art Bay City community designed to feel like a luxury resort, with private rooms and a floor plan that encourages connection.",
    highlights: ["68 private rooms", "Spa & salon", "Cinema", "Shopping trips", "Chef-prepared meals", "24/7 Housekeeping"]
  },
  {
    name: "Big Rapids Fields Comfort Care",
    city: "Big Rapids",
    address: "18900 16 Mile Rd, Big Rapids, MI 49307, United States",
    phone: "(231) 598-9230",
    image: "/assets/communities/big-rapids.jpg",
    careOptions: ["Assisted Living", "Memory Care", "Independent Living"],
    description: "A compassionate Big Rapids community focused on personal needs, dignity, genuine care, value, and quality.",
    highlights: ["Spa & salon", "Cinema", "Shopping trips", "Personal assistance", "Chef-prepared meals", "24/7 Housekeeping"]
  },
  {
    name: "Brighton Comfort Care",
    city: "Brighton",
    address: "Brighton, MI",
    phone: "(810) 247-8442",
    image: "/assets/communities/brighton-apfm.png",
    careOptions: ["Assisted Living", "Memory Care", "Enhanced Living", "Independent Living"],
    description: "A Brighton senior living community designed for community interaction, comfortable private suites, outdoor enjoyment, and everyday independence.",
    highlights: ["Private suites", "Large walkways", "Walk-in showers", "Common lounge", "Spa & salon", "Outdoor spaces"]
  },
  {
    name: "Chesaning Comfort Care",
    city: "Chesaning",
    address: "1800 W Brady Rd, Chesaning, MI 48616, United States",
    phone: "(989) 607-0011",
    image: "/assets/communities/chesaning-apfm.jpg",
    careOptions: ["Assisted Living", "Memory Care", "MemoryVille", "Independent Living"],
    description: "A peaceful country-side community where long-term care, comfort, and a strong sense of community come together.",
    highlights: ["Spa & salon", "Cinema", "Shopping trips", "Personal assistance", "Outdoor activities", "24/7 Housekeeping"]
  },
  {
    name: "Livonia Comfort Care",
    city: "Livonia",
    address: "34020 Plymouth Rd, Livonia, MI 48150, United States",
    phone: "(734) 743-2300",
    image: "/assets/communities/livonia-apfm.jpg",
    careOptions: ["Assisted Living", "Memory Care", "Continuum of Care", "Independent Living"],
    description: "A resident-favorite Livonia community with well-maintained gardens, clean spaces, continuum of care, and warm comfort through every season.",
    highlights: ["Continuum of care", "Coffee", "Spa & salon", "Cinema", "Chef-prepared meals", "24/7 Housekeeping"]
  },
  {
    name: "Marshall Comfort Care",
    city: "Marshall",
    address: "200 Westbrook Ct, Marshall, MI 49068, United States",
    phone: "(269) 781-4997",
    image: "/assets/communities/marshall-apfm.jpg",
    careOptions: ["Assisted Living", "Memory Care", "Independent Living"],
    description: "A safe haven for seniors built around remarkable care, familiar comfort, and Comfort Care's expanding standard for world-class senior living.",
    highlights: ["Spa & salon", "Cinema", "Shopping trips", "Personal assistance", "Chef-prepared meals", "24/7 Housekeeping"]
  },
  {
    name: "Mount Pleasant Comfort Care",
    city: "Mount Pleasant",
    address: "1945 Churchill Blvd, Mt Pleasant, MI 48858, US",
    phone: "(989) 773-7001",
    image: "/assets/communities/mount-pleasant-apfm.jpg",
    careOptions: ["Assisted Living", "Memory Care", "Independent Living"],
    description: "A Mount Pleasant community shaped by Comfort Care's mission to deliver remarkable care while weaving comfort and luxury throughout daily life.",
    highlights: ["Spa & salon", "Cinema", "Shopping trips", "Personal assistance", "Outdoor activities", "24/7 Housekeeping"]
  },
  {
    name: "Reed City Fields Comfort Care",
    city: "Reed City",
    address: "22109 Professional Dr, Reed City, MI 49677, US",
    phone: "(231) 465-4371",
    image: "/assets/communities/reed-city-apfm.jpg",
    careOptions: ["Assisted Living", "Memory Care", "Independent Living"],
    description: "A Northern Michigan community with loving staff, long-term care, comfort, and medication management near the crossroads of US-10 and 131.",
    highlights: ["Medication management", "Spa & salon", "Cinema", "Shopping trips", "Chef-prepared meals", "24/7 Housekeeping"]
  },
  {
    name: "Shields Comfort Care",
    city: "Saginaw",
    address: "9140 Gratiot Rd, Saginaw, MI 48609, United States",
    phone: "(989) 607-0003",
    image: "/assets/communities/shields-apfm.jpg",
    careOptions: ["Assisted Living", "Memory Care", "MemoryVille", "Independent Living"],
    description: "A Saginaw area community near local services, hospitals, recreation, and peaceful outdoor destinations, with 24/7 care support.",
    highlights: ["24/7 care", "Spa & salon", "Cinema", "Shopping trips", "Outdoor activities", "24/7 Housekeeping"]
  },
  {
    name: "Shelby Comfort Care",
    city: "Shelby Township",
    address: "51831 Van Dyke Ave, Shelby Township, MI 48315, US",
    phone: "(586) 933-5594",
    image: "/assets/communities/shelby-apfm.jpg",
    virtualTourUrl: "https://my.matterport.com/show/?m=VFCsQkPt5XQ&ts=1",
    careOptions: ["Assisted Living", "Memory Care", "MemoryVille", "Independent Living"],
    description: "A country club-style Shelby community with no costly entrance fees, home-like warmth, transparent pricing, and specialized senior services.",
    highlights: ["No costly entrance fees", "Spa & salon", "Cinema", "Shopping trips", "Chef-prepared meals", "24/7 Housekeeping"]
  },
  {
    name: "Vassar Comfort Care",
    city: "Vassar",
    address: "5830 Frankenmuth Rd, Vassar, MI 48768, United States",
    phone: "(989) 882-9495",
    image: "/assets/communities/vassar-apfm.jpg",
    careOptions: ["Assisted Living", "Memory Care", "MemoryVille", "Independent Living"],
    description: "A quaint country-side Vassar community where care, love, comfort, and camaraderie are woven into a peaceful daily rhythm.",
    highlights: ["Spa & salon", "Cinema", "Shopping trips", "Personal assistance", "Outdoor activities", "24/7 Housekeeping"]
  }
];

const communityEnhancements = {
  "Brighton Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/hampton-manor-of-brighton-1415300",
    apfmScore: "8.5",
    apfmReviewCount: "37 reviews",
    gallery: [
      "/assets/communities/brighton-apfm.png",
      "https://www.aplaceformom.com/image/apfm-web-api/1333355/hampton-manor-of-brighton--brighton.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1298835/hampton-manor-of-brighton--brighton.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1298843/hampton-manor-of-brighton--brighton.jpg?t=default"
    ]
  },
  "Chesaning Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/chesaning-comfort-care-1436558",
    apfmScore: "8.2",
    apfmReviewCount: "11 reviews",
    gallery: [
      "/assets/communities/chesaning-apfm.jpg",
      "https://www.aplaceformom.com/image/apfm-web-api/1205398/chesaning-comfort-care-indoor-common-area-chesaning.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1205402/chesaning-comfort-care-dining-room-chesaning.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1205410/chesaning-comfort-care-tv-lounge-chesaning.jpg?t=default"
    ]
  },
  "Livonia Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/livonia-comfort-1436562",
    apfmScore: "7.4",
    apfmReviewCount: "16 reviews",
    gallery: [
      "/assets/communities/livonia-apfm.jpg",
      "https://www.aplaceformom.com/image/apfm-web-api/1210430/livonia-comfort-indoor-common-area-livonia.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1210434/livonia-comfort-studio-livonia.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1210442/livonia-comfort-bathroom-livonia.jpg?t=default"
    ]
  },
  "Marshall Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/marshall-comfort-care-66901",
    apfmScore: "8.8",
    apfmReviewCount: "23 reviews",
    gallery: [
      "/assets/communities/marshall-apfm.jpg",
      "https://www.aplaceformom.com/image/apfm-web-api/1189159/marshall-comfort-care--marshall.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1189161/marshall-comfort-care--marshall.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1189164/marshall-comfort-care--marshall.jpg?t=default"
    ]
  },
  "Mount Pleasant Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/mt-pleasant-comfort-care-155882",
    apfmScore: "9.5",
    apfmReviewCount: "10 reviews",
    gallery: [
      "/assets/communities/mount-pleasant-apfm.jpg",
      "https://www.aplaceformom.com/image/apfm-web-api/1196682/mt-pleasant-comfort-care-indoor-common-area-mount-pleasant.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1247572/mt-pleasant-comfort-care--mount-pleasant.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1247576/mt-pleasant-comfort-care--mount-pleasant.jpg?t=default"
    ]
  },
  "Reed City Fields Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/reed-city-fields-1415163",
    apfmScore: "8.9",
    apfmReviewCount: "21 reviews",
    gallery: [
      "/assets/communities/reed-city-apfm.jpg",
      "https://www.aplaceformom.com/image/apfm-web-api/1032258/reed-city-fields-community-exterior-reed-city.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1185486/reed-city-fields-community-exterior-reed-city.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1247396/reed-city-fields--reed-city.jpg?t=default"
    ]
  },
  "Shields Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/shields-comfort-care-1436557",
    apfmScore: "",
    apfmReviewCount: "10 reviews",
    gallery: [
      "/assets/communities/shields-apfm.jpg",
      "https://www.aplaceformom.com/image/apfm-web-api/1205864/shields-comfort-care.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1205852/shields-comfort-care-bedroom-saginaw.jpg?t=default"
    ]
  },
  "Shelby Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/shelby-comfort-care-1414581",
    apfmScore: "8.0",
    apfmReviewCount: "25 reviews",
    gallery: [
      "/assets/communities/shelby-apfm.jpg",
      "https://www.aplaceformom.com/image/apfm-web-api/1080282/shelby-comfort-care-bedroom-shelby-township.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1080284/shelby-comfort-care-salon-shelby-township.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1080291/shelby-comfort-care-dining-room-shelby-township.jpg?t=default"
    ]
  },
  "Vassar Comfort Care": {
    apfmUrl: "https://www.aplaceformom.com/community/vassar-comfort-care-1415155",
    apfmScore: "9.2",
    apfmReviewCount: "9 reviews",
    gallery: [
      "/assets/communities/vassar-apfm.jpg",
      "https://www.aplaceformom.com/image/apfm-web-api/1189352/vassar-comfort-care-in-unit-kitchen-vassar.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1189358/vassar-comfort-care-dining-room-vassar.jpg?t=default",
      "https://www.aplaceformom.com/image/apfm-web-api/1189362/vassar-comfort-care-salon-vassar.jpg?t=default"
    ]
  }
};

const officialCommunityGalleries = {
  "August Haus Comfort Care": [
    "https://comfortcaresl.com/wp-content/uploads/2023/10/august-haus-common-area-2-400x284-1.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/august-haus-common-area-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/august-haus-double-bed-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/august-haus-kitchen-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/august-haus-open-dining-area-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/august-haus-private-dining-room-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/august-haus-resident-room-bed-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/august-haus-bathroom-400x284-1-min.jpg"
  ],
  "Bavarian Comfort Care": [
    "https://comfortcaresl.com/wp-content/uploads/2023/10/assisted-living-bridgeport.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/royal-comfort-care.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/nursing-home-bridgeport.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/frankenmuth-nursing-home.jpg"
  ],
  "Bay City Comfort Care": [
    "https://comfortcaresl.com/wp-content/uploads/2023/10/nursing-homes-in-bay-city-mi.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/independent-living-bay-city-mi.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/bay-city-mi-assisted-living-facilities.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/bay-city-assisted-living.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/assisted-living-essexville-mi.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/assisted-living-bay-city.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/assisted-living-bay-city-michigan.jpg"
  ],
  "Big Rapids Fields Comfort Care": [
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_92391-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_9230-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_0856-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_0227-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_0223-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_0220-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_0219-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_0171-400x284-1-min.jpg"
  ],
  "Chesaning Comfort Care": [
    "https://comfortcaresl.com/wp-content/uploads/2023/10/Ches-CC-In-9-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/Ches-CC-In-1-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/Ches-CC-In-8-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/Ches-CC-In-7-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/Ches-CC-In-6-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/Ches-CC-In-5-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/Ches-CC-In-3-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/Ches-CC-In-2-400x284-1-min.jpg"
  ],
  "Livonia Comfort Care": [
    "https://comfortcaresl.com/wp-content/uploads/2023/10/memory-care-livonia.png",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/assisted-living-livonia.png",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/independent-senior-living-livonia-mi.png",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/new-senior-apartments-in-livonia-mi.png",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/senior-apartments-livonia-mi.png",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/livonia-assisted-living.png",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/livonia-nursing-home.png",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/senior-living-livonia.png"
  ],
  "Marshall Comfort Care": [
    "https://comfortcaresl.com/wp-content/uploads/2023/10/BO2A9482-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/BO2A9477-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/BO2A9484-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/BO2A9471-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/BO2A9465-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/BO2A9458-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/BO2A9448-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/BO2A9445-400x284-1-min.jpg"
  ],
  "Mount Pleasant Comfort Care": [
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_9994-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_9984-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_9980-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_9975-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_9973-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_9954-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_9940-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_9924-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_9907-400x284-1-min.jpg"
  ],
  "Reed City Fields Comfort Care": [
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_3837web-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_3800web-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_3787web-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_3782web-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_3761web-400x284-1-min.jpg"
  ],
  "Shields Comfort Care": [
    "https://comfortcaresl.com/wp-content/uploads/2023/10/assisted-living-facilities-in-saginaw-mi.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/assisted-living-in-saginaw-mi.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/saginaw-cinema.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/nursing-homes-saginaw-mi.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/nursing-homes-in-saginaw.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/saginaw-nursing-homes.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/assisted-living-saginaw-mi.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/nursing-homes-in-saginaw-mi.jpg"
  ],
  "Shelby Comfort Care": [
    "https://comfortcaresl.com/wp-content/uploads/2023/10/DSC_6623_HDR-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/DSC_6556-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/DSC_6540-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/DSC_6524-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/DSC_6503-400x284-1-min.jpg"
  ],
  "Vassar Comfort Care": [
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_2122-7-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_2124-8-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_2199-17-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_2190-16-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_2151-13-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_2135-11-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_2133-10-400x284-1-min.jpg",
    "https://comfortcaresl.com/wp-content/uploads/2023/10/IMG_2131-9-400x284-1.jpg"
  ]
};

const sharedSuitePlans = [
  {
    name: "Two Bedroom Suite",
    details: "2 beds / 1 bathroom / kitchenette",
    note: "A larger residence option for families comparing companion-style living or extra space.",
    image: "https://comfortcaresl.com/wp-content/uploads/2023/09/Screenshot_2023-09-25_225252-removebg-preview.png"
  },
  {
    name: "Grand Oriental",
    details: "1 bed / 1 bathroom / kitchenette",
    note: "A comfortable private suite with space for daily routines and personal furnishings.",
    image: "https://comfortcaresl.com/wp-content/uploads/2023/09/Screenshot_2023-09-25_225225-removebg-preview.png"
  },
  {
    name: "Deluxe Studio",
    details: "1 bed / 1 bathroom / kitchenette",
    note: "A streamlined studio layout designed for comfort, care access, and easy movement.",
    image: "https://comfortcaresl.com/wp-content/uploads/2023/09/Screenshot_2023-09-25_225205-removebg-preview.png"
  },
  {
    name: "Private Suite",
    details: "1 bed / 1 bathroom",
    note: "A simple private residence option for residents who want a cozy, low-maintenance room.",
    image: "https://comfortcaresl.com/wp-content/uploads/2023/09/Screenshot_2023-09-25_225236-removebg-preview.png"
  }
];

const communityFloorPlans = {
  "Bavarian Comfort Care": sharedSuitePlans,
  "Bay City Comfort Care": sharedSuitePlans,
  "Chesaning Comfort Care": sharedSuitePlans,
  "Shields Comfort Care": sharedSuitePlans,
  "Vassar Comfort Care": sharedSuitePlans,
  "Brighton Comfort Care": [
    {
      name: "The Serenity",
      details: "Bedroom / living area / walk-in shower",
      note: "Designed for mobility with generous walkways, a comfortable living zone, and an accessible bathroom."
    },
    {
      name: "The Bay",
      details: "Bedroom / seating area / kitchenette",
      note: "Open living space with a sitting area connected to a kitchenette and a well-sized bedroom."
    }
  ]
};

const communityVideoTours = {
  "August Haus Comfort Care": {
    title: "August Haus Gaylord Virtual Tour",
    youtubeId: "65jBPrrqZis"
  },
  "Bavarian Comfort Care": {
    title: "Bavarian Comfort Care Virtual Tour",
    youtubeId: "U3H50Nze76Y"
  },
  "Bay City Comfort Care": {
    title: "Bay City Comfort Care Virtual Tour",
    youtubeId: "iL1GmxU6bPs"
  },
  "Big Rapids Fields Comfort Care": {
    title: "Big Rapids Fields Virtual Tour",
    youtubeId: "_d5rqCePcPM"
  },
  "Brighton Comfort Care": {
    title: "Brighton Comfort Care Virtual Tour",
    youtubeId: "0s9UT60GvZM"
  },
  "Chesaning Comfort Care": {
    title: "Chesaning Comfort Care Virtual Tour",
    youtubeId: "4TofWuQxTFU"
  },
  "Livonia Comfort Care": {
    title: "Livonia Comfort Care Virtual Tour",
    youtubeId: "idf4mE_SGAo"
  },
  "Marshall Comfort Care": {
    title: "Marshall Comfort Care Virtual Tour",
    youtubeId: "SeULdDXFdXE"
  },
  "Mount Pleasant Comfort Care": {
    title: "Mount Pleasant Comfort Care Virtual Tour",
    youtubeId: "b7Jp50MdmS8"
  },
  "Reed City Fields Comfort Care": {
    title: "Reed City Fields Virtual Tour",
    youtubeId: "s4FrvQUmv4U"
  },
  "Shields Comfort Care": {
    title: "Shields Comfort Care Virtual Tour",
    youtubeId: "RYimiRnEaTw"
  },
  "Vassar Comfort Care": {
    title: "Vassar Comfort Care Virtual Tour",
    youtubeId: "884v1wmNwOA"
  }
};

communities.forEach((community) => {
  const enhancement = communityEnhancements[community.name] || {};
  const officialGallery = officialCommunityGalleries[community.name] || [];
  const floorPlans = communityFloorPlans[community.name] || [];
  const videoTour = communityVideoTours[community.name] || null;
  Object.assign(community, {
    slug: slugify(community.name),
    image: enhancement.image || community.image,
    apfmUrl: enhancement.apfmUrl || "",
    apfmScore: enhancement.apfmScore || "",
    apfmReviewCount: enhancement.apfmReviewCount || "",
    gallery: uniqueImages([community.image, ...officialGallery, ...(enhancement.gallery || [])]),
    floorPlans,
    videoTour
  });
});

const regionMatches = {
  "metro-detroit": ["Shelby Comfort Care", "Livonia Comfort Care", "Brighton Comfort Care"],
  "mid-michigan": ["Bay City Comfort Care", "Bavarian Comfort Care", "Chesaning Comfort Care", "Shields Comfort Care", "Vassar Comfort Care", "Mount Pleasant Comfort Care"],
  northern: ["August Haus Comfort Care", "Big Rapids Fields Comfort Care", "Reed City Fields Comfort Care", "Marshall Comfort Care"]
};

const careTypes = [
  "Assisted Living",
  "Memory Care",
  "Independent Living",
  "Continuum of Care",
  "Not sure yet"
];

const siteUrl = "https://comfort-care-senior-living.vercel.app";

const careDescriptions = {
  "Assisted Living": "Personal support with everyday routines, meals, medication reminders, activities, and a care team nearby around the clock.",
  "Memory Care": "A secure, familiar setting with thoughtful structure for residents living with Alzheimer's, dementia, or changing cognitive needs.",
  "MemoryVille": "Specialized memory support designed around safety, dignity, calming routines, and meaningful daily engagement.",
  "Independent Living": "Comfortable senior living for residents who want community, amenities, meals, and fewer daily maintenance responsibilities.",
  "Enhanced Living": "A higher-touch lifestyle option with private suites, added comfort, and coordinated support for changing needs.",
  "Continuum of Care": "Support that can adapt over time, helping families plan ahead as care needs evolve."
};

const localAreaDetails = {
  "August Haus Comfort Care": {
    hospitals: ["Regional hospital and clinic access around Gaylord", "Primary care, pharmacy, and rehabilitation services nearby"],
    area: ["Close to Gaylord shopping, dining, churches, and family visit routes", "Northern Michigan setting with quiet surroundings and everyday conveniences"]
  },
  "Bavarian Comfort Care": {
    hospitals: ["Regional hospital access in the Bridgeport, Frankenmuth, Bay City, and Saginaw area", "Nearby pharmacies, primary care offices, and outpatient services"],
    area: ["Convenient for families visiting from Bridgeport, Frankenmuth, Saginaw, and Bay City", "Peaceful residential surroundings with quick access to local services"]
  },
  "Bay City Comfort Care": {
    hospitals: ["Close to Bay City regional hospital and specialty care networks", "Nearby pharmacies, primary care offices, and rehabilitation providers"],
    area: ["Near Bay City shopping, dining, waterfront destinations, and family-friendly routes", "Designed for families comparing assisted living and memory care in Bay City, MI"]
  },
  "Big Rapids Fields Comfort Care": {
    hospitals: ["Regional hospital access in the Big Rapids area", "Primary care, pharmacy, and outpatient services nearby"],
    area: ["Convenient for families around Big Rapids, Reed City, Canadian Lakes, and Ferris State University", "Quiet setting with access to local dining, parks, and daily essentials"]
  },
  "Brighton Comfort Care": {
    hospitals: ["Access to Livingston County hospital systems and nearby specialty care", "Local pharmacies, primary care, and therapy providers in the Brighton area"],
    area: ["Convenient for families in Brighton, Howell, Hamburg, and Livingston County", "Close to shopping, dining, parks, and major routes for family visits"]
  },
  "Chesaning Comfort Care": {
    hospitals: ["Regional hospital access around Chesaning, Owosso, and Saginaw", "Nearby primary care, pharmacy, and outpatient services"],
    area: ["Country-side setting near local churches, shops, and small-town services", "A strong fit for families searching for senior living in Chesaning, MI"]
  },
  "Livonia Comfort Care": {
    hospitals: ["Access to major hospital systems across Livonia and western Metro Detroit", "Nearby pharmacies, specialists, primary care, and rehabilitation providers"],
    area: ["Convenient for families in Livonia, Plymouth, Westland, Farmington, and Redford", "Close to shopping, dining, churches, and familiar neighborhood routes"]
  },
  "Marshall Comfort Care": {
    hospitals: ["Regional hospital access in Marshall and Calhoun County", "Nearby pharmacy, primary care, therapy, and outpatient services"],
    area: ["Convenient for families around Marshall, Battle Creek, Albion, and surrounding communities", "Quiet neighborhood feel with access to downtown Marshall and daily essentials"]
  },
  "Mount Pleasant Comfort Care": {
    hospitals: ["Regional hospital and specialty care access in Mount Pleasant", "Nearby pharmacies, primary care offices, and outpatient services"],
    area: ["Convenient for families around Mount Pleasant, Shepherd, Clare, and Central Michigan University", "Close to dining, shopping, parks, and local community destinations"]
  },
  "Reed City Fields Comfort Care": {
    hospitals: ["Regional hospital access in Reed City and nearby Big Rapids", "Primary care, pharmacy, and outpatient services nearby"],
    area: ["Convenient for families in Reed City, Big Rapids, Evart, and surrounding Northern Michigan communities", "Quiet setting near local services and major travel routes"]
  },
  "Shields Comfort Care": {
    hospitals: ["Access to Saginaw regional hospitals and specialty care networks", "Nearby pharmacies, primary care, and outpatient providers"],
    area: ["Convenient for families in Shields, Saginaw, Thomas Township, and Freeland", "Close to shopping, dining, parks, and familiar local routes"]
  },
  "Shelby Comfort Care": {
    hospitals: ["Access to Macomb County and Metro Detroit hospital systems", "Nearby pharmacies, primary care, specialists, and therapy services"],
    area: ["Convenient for families in Shelby Township, Utica, Macomb, Sterling Heights, and Rochester", "Close to shopping, dining, parks, churches, and major family visit routes"]
  },
  "Vassar Comfort Care": {
    hospitals: ["Regional hospital access around Vassar, Caro, Frankenmuth, Bay City, and Saginaw", "Nearby primary care, pharmacy, and outpatient services"],
    area: ["Country-side setting convenient for families throughout Tuscola County", "A peaceful option for families searching senior living near Vassar, MI"]
  }
};

const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");
const loader = document.querySelector("[data-loader]");
const communityGrid = document.querySelector("[data-community-grid]");
const mapChips = document.querySelector("[data-map-chips]");
const routePage = document.querySelector("[data-route-page]");
const footerCommunities = document.querySelector("[data-footer-communities]");
const quizForm = document.querySelector("[data-community-quiz]");
const lightbox = document.querySelector("[data-lightbox]");
const lightboxImage = document.querySelector("[data-lightbox-image]");
const modal = document.querySelector("[data-community-modal]");
const modalTitle = document.querySelector("[data-modal-title]");
const counters = document.querySelectorAll("[data-count-to]");

document.addEventListener("DOMContentLoaded", hideLoader);
window.addEventListener("load", () => {
  hideLoader();
  window.lucide?.createIcons();
});
window.addEventListener("popstate", renderRoute);
setTimeout(hideLoader, 1200);

function hideLoader() {
  loader?.classList.add("is-hidden");
}

window.addEventListener("scroll", () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 20);
  updateActiveNav();
  document.querySelectorAll("[data-parallax]").forEach((el) => {
    const rect = el.getBoundingClientRect();
    const offset = Math.round((rect.top - window.innerHeight / 2) * -0.035);
    el.style.setProperty("--parallax", `${offset}px`);
  });
});

navToggle?.addEventListener("click", () => nav?.classList.toggle("is-open"));
nav?.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link) return;
  nav.classList.remove("is-open");
  if (location.pathname !== "/" && link.getAttribute("href")?.startsWith("#")) {
    event.preventDefault();
    location.href = `/${link.getAttribute("href")}`;
  }
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("is-visible");
  });
}, { threshold: 0.16 });

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

renderCommunities();
renderMapChips();
renderCommunitySpotlight(communities[0]);
renderFooterCommunities();
populateSelects();
bindLeadForms();
bindModal();
bindCommunityMapEvents();
bindQuiz();
bindCounters();
renderRoute();
window.lucide?.createIcons();

function renderCommunities() {
  communityGrid.innerHTML = communities.map((community, index) => `
    <article class="community-card reveal" style="--delay: ${Math.min(index * 35, 260)}ms">
      <img src="${community.image}" alt="${community.name}">
      ${renderCommunityFeatureBadges(community, "image")}
      <div class="community-body">
        <span class="community-city">${community.city}</span>
        <h3>${community.name}</h3>
        <p>${community.description}</p>
        <div class="care-tags">
          ${community.careOptions.slice(0, 3).map((care) => `<span>${care}</span>`).join("")}
        </div>
        <div class="community-meta">
          <span><i data-lucide="map-pin"></i>${community.address}</span>
          <span><i data-lucide="phone"></i>${community.phone}</span>
        </div>
        <div class="community-actions">
          <a class="btn btn-primary" href="/communities/${community.slug}" data-community-detail="${community.name}">
            <i data-lucide="sparkles"></i>View Details
          </a>
          <a class="icon-btn" href="tel:${phoneHref(community.phone)}" aria-label="Call ${community.name}">
            <i data-lucide="phone"></i>
          </a>
        </div>
      </div>
    </article>
  `).join("");

  document.querySelectorAll(".community-card.reveal").forEach((el) => observer.observe(el));
  window.lucide?.createIcons();
}

function renderMapChips() {
  if (!mapChips) return;
  mapChips.innerHTML = communities.map((community) => `
    <button type="button" data-map-chip="${community.name}">${community.city}</button>
  `).join("");
}

function renderFooterCommunities() {
  if (!footerCommunities) return;
  footerCommunities.innerHTML = `
    <h3>Communities</h3>
    <div>
      ${communities.map((community) => `
        <a href="/communities/${community.slug}" data-route-link="${community.slug}">
          <span>${community.name}</span>
          <small>${community.phone}</small>
        </a>
      `).join("")}
    </div>
  `;
}

function renderCommunitySpotlight(community) {
  const spotlight = document.querySelector("[data-community-spotlight]");
  if (!spotlight || !community) return;
  const reviewPanel = community.apfmScore || community.apfmReviewCount
    ? `<div class="profile-score">
        ${community.apfmScore ? `<strong>${community.apfmScore}</strong>` : `<strong>APFM</strong>`}
        <span>${community.apfmReviewCount || "A Place for Mom"}</span>
      </div>`
    : `<div class="profile-score">
        <strong>CCSL</strong>
        <span>Official community profile</span>
      </div>`;
  spotlight.innerHTML = `
    <div class="spotlight-image">
      <img src="${community.image}" alt="${community.name}">
    </div>
    <div class="spotlight-copy">
      <p class="eyebrow">${community.city} Community</p>
      <h3>${community.name}</h3>
      <p>${community.description}</p>
      ${renderCommunityFeatureBadges(community)}
      <div class="profile-meta">
        ${reviewPanel}
        <div class="profile-score">
          <strong>${community.careOptions.length}</strong>
          <span>Care options</span>
        </div>
      </div>
      <div class="profile-gallery">
        ${community.gallery.slice(0, 4).map((src, index) => `
          <button type="button" data-gallery-image="${src}" aria-label="View ${community.name} photo ${index + 1}">
            <img src="${src}" alt="${community.name} photo ${index + 1}" loading="lazy">
          </button>
        `).join("")}
      </div>
      <div class="care-tags">
        ${community.careOptions.map((care) => `<span>${care}</span>`).join("")}
      </div>
      <div class="amenity-strip">
        ${community.highlights.map((item) => `<span>${item}</span>`).join("")}
      </div>
      <div class="spotlight-actions">
        <button class="btn btn-primary" type="button" data-community-inquiry="${community.name}">
          <i data-lucide="calendar-check"></i>Schedule ${community.city} Tour
        </button>
        ${community.floorPlans?.length ? `<a class="btn btn-ghost" href="/communities/${community.slug}#floor-plans"><i data-lucide="layout-template"></i>Floor Plans</a>` : ""}
        ${community.virtualTourUrl ? `<a class="btn btn-ghost" href="/communities/${community.slug}#virtual-tour"><i data-lucide="scan-eye"></i>Virtual 3D Tour</a>` : ""}
        ${community.videoTour ? `<a class="btn btn-ghost" href="/communities/${community.slug}#video-tour"><i data-lucide="play-circle"></i>Video Tour</a>` : ""}
        <a class="btn btn-ghost" href="${directionsUrl(community.address)}" target="_blank" rel="noreferrer">
          <i data-lucide="navigation"></i>Get Directions
        </a>
        ${community.apfmUrl ? `<a class="btn btn-ghost" href="${community.apfmUrl}" target="_blank" rel="noreferrer"><i data-lucide="external-link"></i>APFM Profile</a>` : ""}
      </div>
      <p class="spotlight-contact"><strong>${community.phone}</strong> ${community.address}</p>
    </div>
  `;
  window.lucide?.createIcons();
}

function renderRoute() {
  const path = location.pathname.replace(/\/$/, "") || "/";
  const communityMatch = path.match(/^\/communities\/([a-z0-9-]+)$/);
  if (communityMatch) {
    const community = communities.find((item) => item.slug === communityMatch[1]);
    if (community) {
      showRoutePage(renderCommunityPage(community), community);
      return;
    }
  }
  if (path === "/privacy") {
    showRoutePage(renderLegalPage("Privacy Policy", [
      "Comfort Care Senior Living uses website forms to collect contact details, care needs, preferred community, messages, and tour preferences so our team can respond to families and prospective residents.",
      "Lead information is stored securely in the site database and is visible only to authenticated administrators. We do not sell or share submitted lead information.",
      "For production launch, this page should be reviewed by the business owner or attorney and updated with final legal language, analytics disclosures, and email/SMS consent details."
    ]));
    return;
  }
  if (path === "/terms") {
    showRoutePage(renderLegalPage("Terms of Use", [
      "This website provides general information about Comfort Care Senior Living communities, services, amenities, and ways to contact the team.",
      "Information on this demo site should be verified before making care or placement decisions. Community availability, care options, pricing, and services may change.",
      "For production launch, this page should be reviewed by the business owner or attorney and updated with final business terms."
    ]));
    return;
  }
  showHomePage();
}

function showRoutePage(html, community = null) {
  if (!routePage) return;
  document.body.classList.add("route-active");
  [...document.querySelector("main").children].forEach((section) => {
    section.hidden = section !== routePage;
  });
  routePage.innerHTML = html;
  routePage.hidden = false;
  window.scrollTo({ top: 0, behavior: "instant" });
  if (community) {
    applyCommunitySeo(community);
  } else {
    document.title = routePage.querySelector("h1")?.textContent
      ? `${routePage.querySelector("h1").textContent} | Comfort Care Senior Living`
      : "Comfort Care Senior Living";
    setMeta("description", "Comfort Care Senior Living offers transparent, resort-like assisted living and memory care across Michigan.");
    setCanonical(location.pathname);
  }
  window.lucide?.createIcons();
  if (location.hash) {
    requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

function showHomePage() {
  if (!routePage) return;
  document.body.classList.remove("route-active");
  [...document.querySelector("main").children].forEach((section) => {
    section.hidden = section === routePage;
  });
  routePage.innerHTML = "";
  applyHomeSeo();
  updateActiveNav();
}

function renderCommunityPage(community) {
  const score = community.apfmScore
    ? `<strong>${community.apfmScore}</strong><span>${community.apfmReviewCount || "APFM reviews"}</span>`
    : `<strong>CCSL</strong><span>Official profile</span>`;
  return `
    <div class="community-route">
      <a class="route-back" href="/" data-home-route><i data-lucide="arrow-left"></i>Back to Home</a>
      <div class="route-hero">
        <div>
          <p class="eyebrow">${community.city} Community</p>
          <h1>${community.name}</h1>
          <p>${community.description}</p>
          ${renderCommunityFeatureBadges(community)}
          <div class="route-actions">
            <button class="btn btn-primary" type="button" data-community-inquiry="${community.name}">
              <i data-lucide="calendar-check"></i>Schedule a Tour
            </button>
            <a class="btn btn-ghost" href="tel:${phoneHref(community.phone)}"><i data-lucide="phone"></i>${community.phone}</a>
            ${community.floorPlans?.length ? `<a class="btn btn-ghost" href="#floor-plans"><i data-lucide="layout-template"></i>Floor Plans</a>` : ""}
            ${community.virtualTourUrl ? `<a class="btn btn-ghost" href="#virtual-tour"><i data-lucide="scan-eye"></i>Virtual 3D Tour</a>` : ""}
            ${community.videoTour ? `<a class="btn btn-ghost" href="#video-tour"><i data-lucide="play-circle"></i>Video Tour</a>` : ""}
          </div>
        </div>
        <img src="${community.image}" alt="${community.name}">
      </div>
      <div class="route-stat-grid">
        <article>${score}</article>
        <article><strong>${community.careOptions.length}</strong><span>Care options</span></article>
        <article><strong>24/7</strong><span>Care team availability</span></article>
      </div>
      ${renderSeoIntro(community)}
      <div class="route-content-grid">
        <section>
          <h2>Care and Lifestyle</h2>
          <p>${community.description}</p>
          <div class="care-tags">${community.careOptions.map((item) => `<span>${item}</span>`).join("")}</div>
        </section>
        <section>
          <h2>What Families Can Expect</h2>
          <div class="amenity-strip">${community.highlights.map((item) => `<span>${item}</span>`).join("")}</div>
        </section>
      </div>
      ${renderDetailSections(community)}
      ${renderFloorPlans(community)}
      <section class="route-gallery">
        <div class="section-heading">
          <p class="eyebrow">Gallery</p>
          <h2>Explore ${community.name}</h2>
        </div>
        <div>
          ${community.gallery.map((src, index) => `
            <button type="button" data-lightbox-src="${src}" aria-label="Open ${community.name} photo ${index + 1}">
              <img src="${src}" alt="${community.name} photo ${index + 1}" loading="lazy">
            </button>
          `).join("")}
        </div>
      </section>
      ${renderVirtualTour(community)}
      ${renderVideoTour(community)}
      ${renderPrivateTourPanel(community)}
      <div class="route-location">
        <div>
          <p class="eyebrow">Location</p>
          <h2>${community.city}</h2>
          <p>${community.address}</p>
        </div>
        <a class="btn btn-primary" href="${directionsUrl(community.address)}" target="_blank" rel="noreferrer">
          <i data-lucide="navigation"></i>Get Directions
        </a>
        ${community.apfmUrl ? `<a class="btn btn-ghost" href="${community.apfmUrl}" target="_blank" rel="noreferrer"><i data-lucide="external-link"></i>A Place for Mom</a>` : ""}
      </div>
      ${renderCommunityStickyCta(community)}
    </div>
  `;
}

function renderSeoIntro(community) {
  return `
    <section class="seo-intro-panel">
      <p class="eyebrow">${seoCarePhrase(community)} in ${community.city}, MI</p>
      <h2>A warmer, more transparent way to compare senior living in ${community.city}.</h2>
      <p>${community.name} gives families a clear look at care options, included amenities, room layouts, photos, local access, and private tour next steps before making a decision.</p>
    </section>
  `;
}

function renderDetailSections(community) {
  const local = localAreaDetails[community.name] || {
    hospitals: [`Regional hospital access around ${community.city}`, "Nearby primary care, pharmacy, and outpatient services"],
    area: [`Convenient local access for families visiting ${community.city}`, "Close to everyday services, dining, shopping, and community destinations"]
  };

  return `
    <section class="route-detail-panel">
      <div class="section-heading">
        <p class="eyebrow">Community Details</p>
        <h2>Everything families want to know before visiting.</h2>
      </div>
      <div class="detail-card-grid">
        <article class="detail-card detail-card-feature">
          <span><i data-lucide="heart-handshake"></i></span>
          <h3>Why families choose this location</h3>
          <p>${community.description}</p>
          <div class="detail-chip-row">
            ${community.highlights.slice(0, 5).map((item) => `<span>${item}</span>`).join("")}
          </div>
        </article>
        <article class="detail-card">
          <span><i data-lucide="stethoscope"></i></span>
          <h3>Care available here</h3>
          <div class="care-detail-list">
            ${community.careOptions.map((care) => `
              <div>
                <strong>${care}</strong>
                <p>${careDescriptions[care] || "Personalized senior living support designed around comfort, dignity, and family confidence."}</p>
              </div>
            `).join("")}
          </div>
        </article>
        <article class="detail-card">
          <span><i data-lucide="sparkles"></i></span>
          <h3>What's included</h3>
          <ul>
            ${["Transparent pricing conversation", "Chef-prepared meals", "Activities and social programming", "Comfortable common spaces", "24/7 care team availability", "Housekeeping support"].map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </article>
        <article class="detail-card">
          <span><i data-lucide="map"></i></span>
          <h3>Nearby hospitals and local area</h3>
          <ul>
            ${[...local.hospitals, ...local.area].map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </article>
      </div>
    </section>
  `;
}

function renderPrivateTourPanel(community) {
  return `
    <section class="private-tour-panel">
      <div>
        <p class="eyebrow">Private Tour</p>
        <h2>Schedule a private tour at ${community.name}.</h2>
        <p>Walk through the community, compare available room layouts, ask about care needs, and get a transparent next-step conversation with the Comfort Care team.</p>
      </div>
      <div class="private-tour-actions">
        <button class="btn btn-primary" type="button" data-community-inquiry="${community.name}">
          <i data-lucide="calendar-check"></i>Schedule a Tour
        </button>
        <a class="btn btn-ghost" href="tel:${phoneHref(community.phone)}"><i data-lucide="phone"></i>${community.phone}</a>
      </div>
    </section>
  `;
}

function renderCommunityFeatureBadges(community, variant = "") {
  const badges = [
    community.floorPlans?.length ? { icon: "layout-template", text: "Floor Plans" } : null,
    community.virtualTourUrl ? { icon: "scan-eye", text: "Virtual 3D Tour" } : null,
    community.videoTour ? { icon: "play-circle", text: "Video Tour" } : null
  ].filter(Boolean);

  if (!badges.length) return "";

  return `
    <div class="community-feature-badges${variant ? ` community-feature-badges--${variant}` : ""}">
      ${badges.map((badge) => `
        <span><i data-lucide="${badge.icon}"></i>${badge.text}</span>
      `).join("")}
    </div>
  `;
}

function renderCommunityStickyCta(community) {
  return `
    <aside class="community-sticky-cta" aria-label="${community.name} quick actions">
      <div>
        <strong>${community.name}</strong>
        <span>${community.city} | ${community.phone}</span>
      </div>
      <div>
        <a class="btn btn-ghost" href="tel:${phoneHref(community.phone)}"><i data-lucide="phone"></i>Call</a>
        ${community.floorPlans?.length ? `<a class="btn btn-ghost" href="#floor-plans"><i data-lucide="layout-template"></i>Floor Plans</a>` : ""}
        ${community.virtualTourUrl ? `<a class="btn btn-ghost" href="#virtual-tour"><i data-lucide="scan-eye"></i>3D Tour</a>` : ""}
        ${community.videoTour ? `<a class="btn btn-ghost" href="#video-tour"><i data-lucide="play-circle"></i>Video</a>` : ""}
        <button class="btn btn-primary" type="button" data-community-inquiry="${community.name}">
          <i data-lucide="calendar-check"></i>Schedule Tour
        </button>
      </div>
    </aside>
  `;
}

function renderFloorPlans(community) {
  if (!community.floorPlans?.length) return "";
  return `
    <section class="floor-plan-panel" id="floor-plans">
      <div class="section-heading">
        <p class="eyebrow">Residence Options</p>
        <h2>Floor plans families can compare before touring.</h2>
      </div>
      <div class="floor-plan-grid">
        ${community.floorPlans.map((plan) => `
          <article class="floor-plan-card">
            ${plan.image ? `
              <button class="floor-plan-media" type="button" data-lightbox-src="${plan.image}" aria-label="Open ${plan.name} floor plan">
                <img src="${plan.image}" alt="${plan.name} floor plan" loading="lazy">
              </button>
            ` : `
              <div class="floor-plan-sketch" aria-hidden="true">
                <span></span><span></span><span></span><span></span>
              </div>
            `}
            <div>
              <h3>${plan.name}</h3>
              <strong>${plan.details}</strong>
              <p>${plan.note}</p>
            </div>
          </article>
        `).join("")}
      </div>
      <p class="floor-plan-note">Layouts and availability can vary by community. Schedule a tour for current room availability and pricing details.</p>
    </section>
  `;
}

function renderVirtualTour(community) {
  if (!community.virtualTourUrl) return "";
  return `
    <section class="virtual-tour-panel" id="virtual-tour">
      <div class="virtual-tour-copy">
        <p class="eyebrow">Virtual 3D Tour</p>
        <h2>Step inside ${community.name} before you visit.</h2>
        <p>Explore the community layout, gathering spaces, and home-like details from your phone or computer, then schedule a private walkthrough when your family is ready.</p>
      </div>
      <div class="matterport-frame">
        <iframe
          src="${community.virtualTourUrl}"
          title="${community.name} Matterport 3D virtual tour"
          allow="fullscreen; xr-spatial-tracking"
          allowfullscreen
          loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>
    </section>
  `;
}

function renderVideoTour(community) {
  if (!community.videoTour?.youtubeId) return "";
  return `
    <section class="video-tour-panel" id="video-tour">
      <div class="video-tour-copy">
        <p class="eyebrow">Video Tour</p>
        <h2>Watch the ${community.city} community walkthrough.</h2>
        <p>See real spaces from ${community.name}, then schedule a private visit to compare rooms, amenities, and care options in person.</p>
      </div>
      <div class="youtube-frame">
        <iframe
          src="https://www.youtube-nocookie.com/embed/${community.videoTour.youtubeId}?rel=0&modestbranding=1"
          title="${community.videoTour.title}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
          loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>
    </section>
  `;
}

function renderLegalPage(title, paragraphs) {
  return `
    <div class="legal-page">
      <a class="route-back" href="/" data-home-route><i data-lucide="arrow-left"></i>Back to Home</a>
      <p class="eyebrow">Comfort Care Senior Living</p>
      <h1>${title}</h1>
      ${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}
    </div>
  `;
}

function populateSelects() {
  const communityOptions = `<option value="">Select a community</option>${communities
    .map((community) => `<option value="${community.name}">${community.name}</option>`)
    .join("")}`;
  const careOptions = `<option value="">Select care type</option>${careTypes
    .map((care) => `<option value="${care}">${care}</option>`)
    .join("")}`;

  document.querySelectorAll("[data-community-select]").forEach((select) => {
    select.innerHTML = communityOptions;
  });
  document.querySelectorAll("[data-care-select]").forEach((select) => {
    select.innerHTML = careOptions;
  });
}

function bindModal() {
  document.addEventListener("click", (event) => {
    const homeRoute = event.target.closest("[data-home-route]");
    if (homeRoute) {
      event.preventDefault();
      history.pushState({}, "", "/");
      renderRoute();
      return;
    }

    const routeLink = event.target.closest("[data-route-link]");
    if (routeLink) {
      event.preventDefault();
      history.pushState({}, "", routeLink.getAttribute("href"));
      renderRoute();
      return;
    }

    const detailTrigger = event.target.closest("[data-community-detail]");
    if (detailTrigger) {
      event.preventDefault();
      const community = communities.find((item) => item.name === detailTrigger.dataset.communityDetail);
      history.pushState({}, "", `/communities/${community.slug}`);
      renderRoute();
      return;
    }

    const mapChip = event.target.closest("[data-map-chip]");
    if (mapChip) {
      const community = communities.find((item) => item.name === mapChip.dataset.mapChip);
      selectCommunityProfile(community);
      return;
    }

    const galleryImage = event.target.closest("[data-gallery-image]");
    if (galleryImage) {
      const spotlightImage = document.querySelector(".spotlight-image img");
      if (spotlightImage) spotlightImage.src = galleryImage.dataset.galleryImage;
      openLightbox(galleryImage.dataset.galleryImage);
      return;
    }

    const lightboxTrigger = event.target.closest("[data-lightbox-src]");
    if (lightboxTrigger) {
      openLightbox(lightboxTrigger.dataset.lightboxSrc);
      return;
    }

    const trigger = event.target.closest("[data-community-inquiry]");
    if (!trigger) return;
    const community = trigger.dataset.communityInquiry;
    modalTitle.textContent = `${community} Inquiry`;
    const select = modal.querySelector("[name='preferredCommunity']");
    select.value = community;
    modal.showModal();
  });

  document.querySelector("[data-modal-close]")?.addEventListener("click", () => modal.close());
  document.querySelector("[data-lightbox-close]")?.addEventListener("click", () => lightbox?.close());
}

function bindCommunityMapEvents() {
  window.addEventListener("community-map-select", (event) => {
    const name = event.detail?.communityName || "";
    const city = event.detail?.city || "";
    const community = communities.find((item) => item.name === name || item.city === city);
    selectCommunityProfile(community);
  });
}

function selectCommunityProfile(community) {
  if (!community) return;
  renderCommunitySpotlight(community);
  document.querySelector("[data-community-spotlight]")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function bindQuiz() {
  quizForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(quizForm);
    const region = form.get("region");
    const careType = form.get("careType");
    const names = regionMatches[region] || [];
    const match = communities.find((community) => names.includes(community.name) && community.careOptions.includes(careType))
      || communities.find((community) => names.includes(community.name))
      || communities[0];
    const output = quizForm.querySelector("[data-quiz-result]");
    output.innerHTML = `
      <strong>${match.name}</strong>
      <span>${match.city} may be a strong starting point for ${careType || "your care search"}.</span>
      <a href="/communities/${match.slug}" data-route-link="${match.slug}">View community profile</a>
    `;
  });
}

function openLightbox(src) {
  if (!lightbox || !lightboxImage || !src) return;
  lightboxImage.src = src;
  lightbox.showModal();
}

function updateActiveNav() {
  const sections = [...document.querySelectorAll("main > section[id]:not([hidden])")];
  let active = "";
  sections.forEach((section) => {
    if (section.getBoundingClientRect().top < 160) active = section.id;
  });
  document.querySelectorAll(".nav a[href^='#']").forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("href") === `#${active}`);
  });
}

function applyHomeSeo() {
  document.title = "Comfort Care | Assisted Living & Memory Care in Michigan";
  setMeta("description", "Comfort Care Senior Living offers transparent, resort-like assisted living and memory care across Michigan.");
  setMeta("og:title", "Comfort Care | Assisted Living & Memory Care in Michigan", "property");
  setMeta("og:description", "Comfort Care Senior Living offers transparent, resort-like assisted living and memory care across Michigan.", "property");
  setMeta("og:url", `${siteUrl}/`, "property");
  setMeta("og:type", "website", "property");
  setMeta("og:image", `${siteUrl}/assets/hero-lounge.png`, "property");
  setMeta("twitter:card", "summary_large_image", "name");
  setCanonical("/");
  setRouteSchema({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Comfort Care Senior Living",
    url: siteUrl,
    description: "Comfort Care Senior Living offers transparent, resort-like assisted living and memory care across Michigan.",
    telephone: "+15869335594",
    areaServed: "Michigan",
    serviceType: ["Assisted Living", "Memory Care", "Independent Living"]
  });
}

function applyCommunitySeo(community) {
  const title = `${seoCarePhrase(community)} in ${community.city}, MI | ${community.name}`;
  const description = `${community.name} offers ${community.careOptions.join(", ")} in ${community.city}, Michigan with photos, floor plans, local area details, transparent next steps, and private tours.`;
  const url = `${siteUrl}/communities/${community.slug}`;

  document.title = title;
  setMeta("description", description);
  setMeta("og:title", title, "property");
  setMeta("og:description", description, "property");
  setMeta("og:url", url, "property");
  setMeta("og:image", absoluteUrl(community.image), "property");
  setMeta("twitter:card", "summary_large_image", "name");
  setCanonical(`/communities/${community.slug}`);
  setRouteSchema({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: community.name,
    url,
    image: absoluteUrl(community.image),
    telephone: community.phone,
    address: community.address,
    areaServed: `${community.city}, Michigan`,
    description,
    brand: {
      "@type": "Brand",
      name: "Comfort Care Senior Living"
    },
    knowsAbout: community.careOptions,
    amenityFeature: community.highlights.map((highlight) => ({
      "@type": "LocationFeatureSpecification",
      name: highlight
    }))
  });
}

function setMeta(name, content, attribute = "name") {
  if (!content) return;
  let tag = document.head.querySelector(`meta[${attribute}="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setCanonical(path) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", `${siteUrl}${path === "/" ? "" : path}`);
}

function setRouteSchema(schema) {
  let script = document.head.querySelector("#route-schema");
  if (!script) {
    script = document.createElement("script");
    script.id = "route-schema";
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(schema);
}

function seoCarePhrase(community) {
  const hasAssisted = community.careOptions.includes("Assisted Living");
  const hasMemory = community.careOptions.includes("Memory Care") || community.careOptions.includes("MemoryVille");
  if (hasAssisted && hasMemory) return "Assisted Living and Memory Care";
  if (hasAssisted) return "Assisted Living";
  if (hasMemory) return "Memory Care";
  return "Senior Living";
}

function absoluteUrl(value) {
  if (/^https?:\/\//i.test(value)) return value;
  return `${siteUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueImages(images) {
  return [...new Set(images.filter(Boolean))];
}

function phoneHref(phone) {
  return String(phone).replace(/[^\d+]/g, "");
}

function directionsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function bindLeadForms() {
  document.querySelectorAll("[data-lead-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = form.querySelector(".form-status");
      const button = form.querySelector("button[type='submit']");
      status.textContent = "";
      button.disabled = true;
      button.classList.add("is-loading");

      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        const validationError = validateLeadContact(payload);
        if (validationError) throw new Error(validationError);
        payload.kind = form.dataset.kind || "contact";
        const response = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.errors?.[0] || data.error || "Please check the form and try again.");
        status.innerHTML = `
          <span class="success-check"><i data-lucide="check"></i></span>
          <strong>Request received.</strong>
          <small>Our team will follow up soon. Your information is securely stored and never shared.</small>
        `;
        window.lucide?.createIcons();
        form.reset();
        if (form.closest("dialog")) setTimeout(() => modal.close(), 1200);
      } catch (error) {
        status.textContent = error.message;
      } finally {
        button.disabled = false;
        button.classList.remove("is-loading");
      }
    });
  });
}

function bindCounters() {
  if (!counters.length) return;
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || entry.target.dataset.counted === "true") return;
      entry.target.dataset.counted = "true";
      animateCounter(entry.target);
    });
  }, { threshold: 0.45 });
  counters.forEach((counter) => counterObserver.observe(counter));
}

function validateLeadContact(payload) {
  const name = String(payload.fullName || payload.name || "").trim();
  const phone = String(payload.phone || "").trim();
  const email = String(payload.email || "").trim();
  if (!name) return "Full name is required.";
  if (!phone) return "Phone is required.";
  if (!isValidPhone(phone)) return "Enter a valid 10-digit phone number.";
  if (email && !isValidEmail(email)) return "Enter a valid email or leave it blank.";
  return "";
}

function isValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

function isValidEmail(value) {
  const email = String(value || "").trim();
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email) && !email.includes("..");
}

function animateCounter(counter) {
  const target = Number(counter.dataset.countTo || 0);
  const suffix = counter.dataset.countSuffix || "";
  const duration = target > 1000 ? 1200 : 900;
  const start = performance.now();
  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    counter.textContent = `${Math.round(target * eased)}${suffix}`;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
