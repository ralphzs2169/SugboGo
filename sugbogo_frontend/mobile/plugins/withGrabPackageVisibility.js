const { withAndroidManifest } = require("expo/config-plugins");

const GRAB_SCHEME = "grab";
const PACKAGE_LAUNCHED_PROVIDERS = [
  "com.moveit.app.customer",
  "com.taxsee.taxsee",
];

/** Adds Android visibility for externally launched ride-provider apps. */
function withGrabPackageVisibility(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const manifest = androidConfig.modResults.manifest;
    const queries = manifest.queries ?? [];
    const primaryQueries = queries[0] ?? {};
    const intents = primaryQueries.intent ?? [];
    const packages = primaryQueries.package ?? [];
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

    for (const packageName of PACKAGE_LAUNCHED_PROVIDERS) {
      const hasPackageQuery = packages.some(
        (packageQuery) =>
          packageQuery.$["android:name"] === packageName,
      );

      if (!hasPackageQuery) {
        packages.push({
          $: {
            "android:name": packageName,
          },
        });
      }
    }

    manifest.queries = [
      {
        ...primaryQueries,
        intent: intents,
        package: packages,
      },
      ...queries.slice(1),
    ];

    return androidConfig;
  });
}

module.exports = withGrabPackageVisibility;
