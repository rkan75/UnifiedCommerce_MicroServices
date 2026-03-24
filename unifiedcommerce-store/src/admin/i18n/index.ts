/**
 * Custom i18n overrides for the admin dashboard.
 * These are deep-merged with the default Medusa translations.
 * Structure must match core: language key (e.g. "en") -> { translation: { ...keys } }.
 */
export default {
  resources: {
    en: {
      translation: {
        login: {
          title: "Welcome to TCS Unified AI Commerce",
          hint: "Sign in to access the account area",
        },
        invite: {
          title: "Welcome to TCS Unified AI Commerce",
          hint: "Create your account below",
        },
      },
    },
  },
}