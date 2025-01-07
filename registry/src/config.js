const dev = {
    PRIVY_APP_ID: "cm5gnvpmz0bytxokknq8flluf",
    SHINKAI_STORE_API: "http://localhost:3300"
};

const prod = {
    PRIVY_APP_ID: "cm5gnvpmz0bytxokknq8flluf",
    SHINKAI_STORE_API: "https://shinkai-store-302883622007.us-central1.run.app"
};

const config = {
    // Default to dev if not set
    ...(process.env.REACT_APP_STAGE === "prod" ? prod : dev),
};

export default config;