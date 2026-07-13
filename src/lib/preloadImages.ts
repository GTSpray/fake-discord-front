/** Précharge des images en parallèle (les erreurs réseau ne bloquent pas). */
export async function preloadImages(urls: Iterable<string>): Promise<void> {
  const unique = [...new Set(urls)];

  await Promise.all(
    unique.map(
      (url) =>
        new Promise<void>((resolve) => {
          if (!url.startsWith('http')) {
            resolve();
            return;
          }
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        }),
    ),
  );
}
