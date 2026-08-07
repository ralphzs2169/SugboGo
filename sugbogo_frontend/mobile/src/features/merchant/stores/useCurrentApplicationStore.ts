// import { create } from "zustand";

// import { getCurrentApplication } from "../api/merchantApplication.service";

// import type { ApplicationDetailResponse } from "../types/registration/registrationApi.types";

// type CurrentApplicationStore = {
//   application: ApplicationDetailResponse | null;

//   isLoading: boolean;

//   error: boolean;

//   /**
//    * Updates the current application in the shared store.
//    */
//   setApplication: (application: ApplicationDetailResponse | null) => void;

//   /**
//    * Fetches the authenticated user's current merchant application.
//    */
//   fetchApplication: () => Promise<void>;
// };

// export const useCurrentApplicationStore = create<CurrentApplicationStore>(
//   (set) => ({
//     application: null,

//     isLoading: true,

//     error: false,

//     setApplication: (application) =>
//       set({
//         application,
//       }),

//     fetchApplication: async () => {
//       set({
//         isLoading: true,
//         error: false,
//       });

//       const response = await getCurrentApplication();

//       if (!response.success) {
//         if (response.code === "APPLICATION_NOT_FOUND") {
//           set({
//             application: null,
//             error: false,
//             isLoading: false,
//           });

//           return;
//         }

//         set({
//           application: null,
//           error: true,
//           isLoading: false,
//         });

//         return;
//       }

//       set({
//         application: response.data,
//         error: false,
//         isLoading: false,
//       });
//     },
//   }),
// );
