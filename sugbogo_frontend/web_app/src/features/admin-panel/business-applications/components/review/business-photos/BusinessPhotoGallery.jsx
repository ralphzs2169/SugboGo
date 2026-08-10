/**
 * Displays submitted business photos as an interactive thumbnail gallery.
 *
 * Allows administrators to select a photo for detailed preview while
 * keeping photo metadata visible during normal review.
 */
export default function BusinessPhotoGallery({ photos = [], onPhotoSelect }) {
  if (!photos.length) {
    return (
      <div className="rounded-lg border border-stroke bg-surface-muted p-5">
        <p className="text-sm font-medium text-text-primary">
          No business photos submitted
        </p>

        <p className="mt-1 text-sm text-text-secondary">
          The applicant did not provide any business photos.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {photos.map((photo, index) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onPhotoSelect(index)}
          className="group cursor-pointer overflow-hidden rounded-lg border border-stroke bg-surface text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {/* Photo thumbnail */}
          <div className="relative aspect-square overflow-hidden bg-surface-muted">
            <img
              src={photo.photo_url}
              alt={photo.file_name || "Business photo"}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />

            <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
          </div>

          {/* Photo metadata */}
          <div className="border-t border-stroke bg-surface px-3 py-3">
            <p className="text-xs font-medium capitalize text-text-primary">
              {photo.category}
            </p>

            <p className="mt-1 truncate text-xs text-text-secondary">
              {photo.file_name || "Unnamed photo"}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
