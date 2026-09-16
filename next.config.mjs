/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Contact-upload Server Actions (createContactList/mergeContacts) send
      // the entire parsed file as one call's argument -- a large merged file
      // (tens of thousands of rows) comfortably exceeds Next's 1mb default,
      // which fails outright with "Body exceeded 1 MB limit" before the
      // action ever runs.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
