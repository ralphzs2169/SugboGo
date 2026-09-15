const { withAndroidManifest } = require("expo/config-plugins");

const GRAB_SCHEME = "grab";

/** Adds Android package visibility for Grab without registering an inbound link. */
function withGrabPackageVisibility(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const manifest = androidConfig.modResults.manifest;
    const queries = manifest.queries ?? [];
    const primaryQueries = queries[0] ?? {};
    const intents = primaryQueries.intent ?? [];
    const hasGrabQuery = intents.some((intent) =>
      intent.data?.some(
        (data) => data.$["android:scheme"] === GRAB_SCHEME,
      ),
    );

    if (!hasGrabQuery) {
      intents.push({
        action: [
          {
            $: {
              "android:name": "android.intent.action.VIEW",
            },
          },
        ],
        category: [
          {
            $: {
              "android:name": "android.intent.category.BROWSABLE",
            },
          },
        ],
        data: [
          {
            $: {
              "android:scheme": GRAB_SCHEME,
            },
          },
        ],
      });
    }

    manifest.queries = [
      {
        ...primaryQueries,
        intent: intents,
      },
      ...queries.slice(1),
    ];

    return androidConfig;
  });
}

module.exports = withGrabPackageVisibility;
