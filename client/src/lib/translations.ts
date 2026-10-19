export type Language = 'en' | 'fil';

export interface Translations {
  // Common
  loading: string;
  submit: string;
  cancel: string;
  next: string;
  previous: string;
  back: string;
  add: string;
  remove: string;
  save: string;
  edit: string;
  delete: string;
  confirm: string;
  yes: string;
  no: string;
  search: string;
  filter: string;
  close: string;

  // Navigation
  dashboard: string;
  orders: string;
  restaurants: string;
  riders: string;
  customers: string;
  settings: string;
  profile: string;
  logout: string;

  // Authentication
  login: string;
  register: string;
  welcome: string;
  loginTitle: string;
  registerTitle: string;
  username: string;
  password: string;
  confirmPassword: string;
  forgotPassword: string;
  dontHaveAccount: string;
  alreadyHaveAccount: string;
  signIn: string;
  signUp: string;

  // Common Fields
  name: string;
  email: string;
  phone: string;
  address: string;
  description: string;
  price: string;
  quantity: string;
  total: string;
  status: string;
  date: string;
  time: string;

  // Order Status
  orderStatus: {
    pending: string;
    confirmed: string;
    preparing: string;
    ready: string;
    pickedUp: string;
    delivered: string;
    cancelled: string;
    // Pabili-specific statuses
    onTheWay: string;
    purchasing: string;
  };

  // Restaurant Management
  restaurant: {
    addRestaurant: string;
    editRestaurant: string;
    restaurantInfo: string;
    menuManagement: string;
    addMenuItem: string;
    editMenuItem: string;
    categories: string;
    availability: string;
    hours: string;
    openingTime: string;
    closingTime: string;
    deliveryFee: string;
  };

  // Rider Management
  rider: {
    available: string;
    busy: string;
    offline: string;
    riderDetails: string;
    assignOrder: string;
    currentDeliveries: string;
    deliveryHistory: string;
    vehicleType: string;
    plateNumber: string;
    licenseNumber: string;
  };

  // Customer Management
  customer: {
    customerInfo: string;
    orderHistory: string;
    savedAddresses: string;
    preferences: string;
    defaultAddress: string;
  };

  // Pabili Service
  pabiliService: string;
  pabiliDescription: string;
  pabiliHowItWorks: string;
  pabiliSteps: {
    shoppingList: string;
    locations: string;
    reviewSubmit: string;
  };

  // Step 1 - Shopping List
  createShoppingList: string;
  shoppingListDescription: string;
  shoppingList: string;
  itemName: string;
  estimatedPrice: string;
  notes: string;
  notesOptional: string;
  addAnotherItem: string;
  totalBudget: string;
  totalBudgetPlaceholder: string;
  itemNamePlaceholder: string;
  notesPlaceholder: string;

  // Step 2 - Locations
  setLocations: string;
  locationsDescription: string;
  setPickupLocation: string;
  setDeliveryLocation: string;
  pickupLocationDescription: string;
  deliveryLocationDescription: string;
  searchPickupLocation: string;
  searchDeliveryLocation: string;
  selectedLocation: string;

  // Step 3 - Review
  reviewOrder: string;
  reviewOrderDescription: string;
  orderSummary: string;
  items: string;
  itemsTotal: string;
  paymentMethod: string;
  selectPaymentMethod: string;
  cashOnDelivery: string;
  gcash: string;
  specialInstructions: string;
  specialInstructionsOptional: string;
  specialInstructionsPlaceholder: string;
  submitOrder: string;
  submitting: string;

  // How it works
  howItWorksSteps: {
    step1: string;
    step2: string;
    step3: string;
    step4: string;
    step5: string;
  };

  // Validation messages
  validation: {
    completeShoppingList: string;
    completeShoppingListDesc: string;
    setLocationsRequired: string;
    setLocationsRequiredDesc: string;
    itemNameRequired: string;
    quantityRequired: string;
    budgetRequired: string;
  };

  // Success messages
  success: {
    orderPlaced: string;
    orderPlacedDescription: string;
  };

  // Rider Status Actions
  riderActions: {
    itemsPurchasedOnTheWay: string;
    pickedUp: string;
    onTheWay: string;
    markDelivered: string;
    viewDetails: string;
  };

  // Messaging
  messaging: {
    chatWith: string;
    typeMessage: string;
    sendMessage: string;
    messagingAvailable: string;
    messagingUnavailable: string;
    noMessages: string;
    startConversation: string;
    deliveryUpdates: string;
    customerSupport: string;
  };

  // Language switcher
  language: string;
  english: string;
  filipino: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    // Common
    loading: "Loading...",
    submit: "Submit",
    cancel: "Cancel",
    next: "Next",
    previous: "Previous",
    back: "Back",
    add: "Add",
    remove: "Remove",
    save: "Save",
    edit: "Edit",
    delete: "Delete",
    confirm: "Confirm",
    yes: "Yes",
    no: "No",
    search: "Search",
    filter: "Filter",
    close: "Close",

    // Navigation
    dashboard: "Dashboard",
    orders: "Orders",
    restaurants: "Restaurants",
    riders: "Riders",
    customers: "Customers",
    settings: "Settings",
    profile: "Profile",
    logout: "Logout",

    // Authentication
    login: "Login",
    register: "Register",
    welcome: "Welcome to Reina Pabili",
    loginTitle: "Sign in to your account",
    registerTitle: "Create a new account",
    username: "Username",
    password: "Password",
    confirmPassword: "Confirm Password",
    forgotPassword: "Forgot Password?",
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: "Already have an account?",
    signIn: "Sign In",
    signUp: "Sign Up",

    // Common Fields
    name: "Name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    description: "Description",
    price: "Price",
    quantity: "Quantity",
    total: "Total",
    status: "Status",
    date: "Date",
    time: "Time",

    // Order Status
    orderStatus: {
      pending: "Pending",
      confirmed: "Confirmed",
      preparing: "Preparing",
      ready: "Ready for Pickup",
      pickedUp: "Picked Up",
      delivered: "Delivered",
      cancelled: "Cancelled",
      // Pabili-specific statuses
      onTheWay: "On the Way",
      purchasing: "Purchasing Items",
    },

    // Rider Status Actions
    riderActions: {
      itemsPurchasedOnTheWay: "Items Purchased - On The Way",
      pickedUp: "Picked Up",
      onTheWay: "On The Way",
      markDelivered: "Mark Delivered",
      viewDetails: "View Details",
    },

    // Restaurant Management
    restaurant: {
      addRestaurant: "Add Restaurant",
      editRestaurant: "Edit Restaurant",
      restaurantInfo: "Restaurant Information",
      menuManagement: "Menu Management",
      addMenuItem: "Add Menu Item",
      editMenuItem: "Edit Menu Item",
      categories: "Categories",
      availability: "Availability",
      hours: "Operating Hours",
      openingTime: "Opening Time",
      closingTime: "Closing Time",
      deliveryFee: "Delivery Fee",
    },

    // Rider Management
    rider: {
      available: "Available",
      busy: "Busy",
      offline: "Offline",
      riderDetails: "Rider Details",
      assignOrder: "Assign Order",
      currentDeliveries: "Current Deliveries",
      deliveryHistory: "Delivery History",
      vehicleType: "Vehicle Type",
      plateNumber: "Plate Number",
      licenseNumber: "License Number",
    },

    // Customer Management
    customer: {
      customerInfo: "Customer Information",
      orderHistory: "Order History",
      savedAddresses: "Saved Addresses",
      preferences: "Preferences",
      defaultAddress: "Default Address",
    },

    // Pabili Service
    pabiliService: "Pabili Service",
    pabiliDescription: "Request a rider to purchase items for you",
    pabiliHowItWorks: "How Pabili Works:",
    pabiliSteps: {
      shoppingList: "Shopping List",
      locations: "Locations",
      reviewSubmit: "Review & Submit"
    },

    // Step 1 - Shopping List
    createShoppingList: "Create Your Shopping List",
    shoppingListDescription: "Add all the items you want our rider to purchase for you.",
    shoppingList: "Shopping List",
    itemName: "Item Name",
    estimatedPrice: "Estimated Price (₱)",
    notes: "Notes",
    notesOptional: "Notes (Optional)",
    addAnotherItem: "Add Another Item",
    totalBudget: "Total Budget (₱)",
    totalBudgetPlaceholder: "Maximum amount you're willing to spend",
    itemNamePlaceholder: "e.g., Milk, Bread, Medicine",
    notesPlaceholder: "Brand, size, specific requirements",

    // Step 2 - Locations
    setLocations: "Set Pickup & Delivery Locations",
    locationsDescription: "Pin the exact locations for pickup and delivery using Google Maps.",
    setPickupLocation: "Set Pickup Location",
    setDeliveryLocation: "Set Delivery Location",
    pickupLocationDescription: "Search for the store or establishment, or click anywhere on the map to pin the exact location.",
    deliveryLocationDescription: "Search for your address or click anywhere on the map to pin your exact delivery location.",
    searchPickupLocation: "Search for pickup location...",
    searchDeliveryLocation: "Search for delivery location...",
    selectedLocation: "Selected Location",

    // Step 3 - Review
    reviewOrder: "Review Your Order",
    reviewOrderDescription: "Review your order details and complete your pabili request.",
    orderSummary: "Order Summary",
    items: "Items:",
    itemsTotal: "Items Total:",
    paymentMethod: "Payment Method",
    selectPaymentMethod: "Select payment method",
    cashOnDelivery: "Cash on Delivery",
    gcash: "GCash",
    specialInstructions: "Special Instructions",
    specialInstructionsOptional: "Special Instructions (Optional)",
    specialInstructionsPlaceholder: "Any special instructions for the rider...",
    submitOrder: "Submit Order",
    submitting: "Submitting...",

    // How it works
    howItWorksSteps: {
      step1: "Submit your shopping list",
      step2: "Rider goes to pickup location",
      step3: "Rider purchases your items",
      step4: "Items delivered to your location",
      step5: "Pay for items + delivery fee"
    },

    // Validation messages
    validation: {
      completeShoppingList: "Please complete your shopping list",
      completeShoppingListDesc: "Add at least one item with a name and quantity.",
      setLocationsRequired: "Please set locations",
      setLocationsRequiredDesc: "Both pickup and delivery locations are required.",
      itemNameRequired: "Item name is required",
      quantityRequired: "Quantity must be at least 1",
      budgetRequired: "Budget must be specified"
    },

    // Success messages
    success: {
      orderPlaced: "Order Placed Successfully!",
      orderPlacedDescription: "Your pabili order has been submitted. A rider will be assigned soon."
    },

    // Messaging
    messaging: {
      chatWith: "Chat with",
      typeMessage: "Type your message...",
      sendMessage: "Send Message",
      messagingAvailable: "Messaging available once rider picks up order",
      messagingUnavailable: "Messaging not available for this order",
      noMessages: "No messages yet",
      startConversation: "Start the conversation",
      deliveryUpdates: "Delivery Updates",
      customerSupport: "Customer Support",
    },

    // Language switcher
    language: "Language",
    english: "English",
    filipino: "Filipino"
  },

  fil: {
    // Common
    loading: "Naglo-load...",
    submit: "Ipasa",
    cancel: "Kanselahin",
    next: "Susunod",
    previous: "Nakaraan",
    back: "Bumalik",
    add: "Magdagdag",
    remove: "Alisin",
    save: "I-save",
    edit: "I-edit",
    delete: "Tanggalin",
    confirm: "Kumpirmahin",
    yes: "Oo",
    no: "Hindi",
    search: "Maghanap",
    filter: "I-filter",
    close: "Isara",

    // Navigation
    dashboard: "Dashboard",
    orders: "Mga Order",
    restaurants: "Mga Restaurant",
    riders: "Mga Rider",
    customers: "Mga Customer",
    settings: "Mga Setting",
    profile: "Profile",
    logout: "Logout",

    // Authentication
    login: "Login",
    register: "Mag-register",
    welcome: "Maligayang pagdating sa Reina Pabili",
    loginTitle: "Mag-sign in sa inyong account",
    registerTitle: "Gumawa ng bagong account",
    username: "Username",
    password: "Password",
    confirmPassword: "Kumpirmahin ang Password",
    forgotPassword: "Nakalimutan ang Password?",
    dontHaveAccount: "Walang account?",
    alreadyHaveAccount: "May account na?",
    signIn: "Mag-sign In",
    signUp: "Mag-sign Up",

    // Common Fields
    name: "Pangalan",
    email: "Email",
    phone: "Telepono",
    address: "Address",
    description: "Paglalarawan",
    price: "Presyo",
    quantity: "Bilang",
    total: "Kabuuan",
    status: "Status",
    date: "Petsa",
    time: "Oras",

    // Order Status
    orderStatus: {
      pending: "Naghihintay",
      confirmed: "Nakumpirma",
      preparing: "Naghahanda",
      ready: "Handa na para Kunin",
      pickedUp: "Nakuha na",
      delivered: "Na-deliver na",
      cancelled: "Nakansela",
      // Pabili-specific statuses
      onTheWay: "Papunta na",
      purchasing: "Bumibili ng mga Gamit",
    },

    // Rider Status Actions
    riderActions: {
      itemsPurchasedOnTheWay: "Nabili na ang mga Gamit - Papunta na",
      pickedUp: "Nakuha na",
      onTheWay: "Papunta na",
      markDelivered: "Markahan bilang Na-deliver",
      viewDetails: "Tingnan ang Detalye",
    },

    // Restaurant Management
    restaurant: {
      addRestaurant: "Magdagdag ng Restaurant",
      editRestaurant: "I-edit ang Restaurant",
      restaurantInfo: "Impormasyon ng Restaurant",
      menuManagement: "Pamamahala ng Menu",
      addMenuItem: "Magdagdag ng Menu Item",
      editMenuItem: "I-edit ang Menu Item",
      categories: "Mga Kategorya",
      availability: "Availability",
      hours: "Mga Oras ng Operasyon",
      openingTime: "Oras ng Pagbubukas",
      closingTime: "Oras ng Pagsasara",
      deliveryFee: "Delivery Fee",
    },

    // Rider Management
    rider: {
      available: "Available",
      busy: "Abala",
      offline: "Offline",
      riderDetails: "Mga Detalye ng Rider",
      assignOrder: "I-assign ang Order",
      currentDeliveries: "Kasalukuyang Delivery",
      deliveryHistory: "Kasaysayan ng Delivery",
      vehicleType: "Uri ng Sasakyan",
      plateNumber: "Plate Number",
      licenseNumber: "License Number",
    },

    // Customer Management
    customer: {
      customerInfo: "Impormasyon ng Customer",
      orderHistory: "Kasaysayan ng Order",
      savedAddresses: "Mga Na-save na Address",
      preferences: "Mga Preference",
      defaultAddress: "Default Address",
    },

    // Pabili Service
    pabiliService: "Serbisyong Pabili",
    pabiliDescription: "Mag-request ng rider na bumili para sa iyo",
    pabiliHowItWorks: "Paano Gumagana ang Pabili:",
    pabiliSteps: {
      shoppingList: "Lista ng Pamimili",
      locations: "Mga Lokasyon",
      reviewSubmit: "Suriin at Ipasa"
    },

    // Step 1 - Shopping List
    createShoppingList: "Gumawa ng Inyong Lista ng Pamimili",
    shoppingListDescription: "Idagdag ang lahat ng mga bagay na gusto ninyong bilhin ng aming rider.",
    shoppingList: "Lista ng Pamimili",
    itemName: "Pangalan ng Bagay",
    estimatedPrice: "Tinatayang Presyo (₱)",
    notes: "Mga Tala",
    notesOptional: "Mga Tala (Opsyonal)",
    addAnotherItem: "Magdagdag ng Isa Pang Bagay",
    totalBudget: "Kabuuang Budget (₱)",
    totalBudgetPlaceholder: "Pinakamataas na halagang handang gastusin",
    itemNamePlaceholder: "hal., Gatas, Tinapay, Gamot",
    notesPlaceholder: "Brand, laki, mga partikular na pangangailangan",

    // Step 2 - Locations
    setLocations: "Itakda ang Pickup at Delivery Locations",
    locationsDescription: "I-pin ang eksaktong mga lokasyon para sa pickup at delivery gamit ang Google Maps.",
    setPickupLocation: "Itakda ang Pickup Location",
    setDeliveryLocation: "Itakda ang Delivery Location",
    pickupLocationDescription: "Maghanap ng tindahan o establisimento, o mag-click sa mapa para i-pin ang eksaktong lokasyon.",
    deliveryLocationDescription: "Maghanap ng inyong address o mag-click sa mapa para i-pin ang eksaktong delivery location.",
    searchPickupLocation: "Maghanap ng pickup location...",
    searchDeliveryLocation: "Maghanap ng delivery location...",
    selectedLocation: "Napiling Lokasyon",

    // Step 3 - Review
    reviewOrder: "Suriin ang Inyong Order",
    reviewOrderDescription: "Suriin ang mga detalye ng inyong order at kumpletuhin ang inyong pabili request.",
    orderSummary: "Buod ng Order",
    items: "Mga Bagay:",
    itemsTotal: "Kabuuan ng mga Bagay:",
    paymentMethod: "Paraan ng Pagbabayad",
    selectPaymentMethod: "Pumili ng paraan ng pagbabayad",
    cashOnDelivery: "Cash on Delivery",
    gcash: "GCash",
    specialInstructions: "Mga Espesyal na Tagubilin",
    specialInstructionsOptional: "Mga Espesyal na Tagubilin (Opsyonal)",
    specialInstructionsPlaceholder: "Anumang espesyal na tagubilin para sa rider...",
    submitOrder: "Ipasa ang Order",
    submitting: "Nagpapasa...",

    // How it works
    howItWorksSteps: {
      step1: "Ipasa ang inyong lista ng pamimili",
      step2: "Pupunta ang rider sa pickup location",
      step3: "Bibilhin ng rider ang inyong mga bagay",
      step4: "Ide-deliver ang mga bagay sa inyong lokasyon",
      step5: "Magbayad para sa mga bagay + delivery fee"
    },

    // Validation messages
    validation: {
      completeShoppingList: "Pakikumpletuhin ang inyong lista ng pamimili",
      completeShoppingListDesc: "Magdagdag ng kahit isang bagay na may pangalan at bilang.",
      setLocationsRequired: "Pakiitakda ang mga lokasyon",
      setLocationsRequiredDesc: "Kailangan ang pickup at delivery locations.",
      itemNameRequired: "Kailangan ang pangalan ng bagay",
      quantityRequired: "Ang bilang ay dapat kahit 1",
      budgetRequired: "Kailangan itakda ang budget"
    },

    // Success messages
    success: {
      orderPlaced: "Matagumpay na Naipasa ang Order!",
      orderPlacedDescription: "Naipasa na ang inyong pabili order. Malapit nang mag-assign ng rider."
    },

    // Messaging
    messaging: {
      chatWith: "Makipag-chat sa",
      typeMessage: "I-type ang inyong mensahe...",
      sendMessage: "Magpadala ng Mensahe",
      messagingAvailable: "Maaaring mag-message kapag nakuha na ng rider ang order",
      messagingUnavailable: "Hindi available ang messaging para sa order na ito",
      noMessages: "Walang mensahe pa",
      startConversation: "Simulan ang pag-uusap",
      deliveryUpdates: "Mga Update sa Delivery",
      customerSupport: "Customer Support",
    },

    // Language switcher
    language: "Wika",
    english: "Ingles",
    filipino: "Filipino"
  }
};

export const useTranslation = (language: Language = 'en') => {
  return translations[language];
};
