export async function downloadFoldrProjectZip(): Promise<void> {
  const projectInfo = {
    name: 'Foldr',
    tagline: 'A place for everything.',
    description: 'A browser-based smart file organizer.',
    architecture: 'Serverless React application',
    technologies: [
      'React',
      'TypeScript',
      'Vite',
      'File System Access API',
    ],
  };

  const blob = new Blob(
    [JSON.stringify(projectInfo, null, 2)],
    { type: 'application/json' }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'foldr-project-info.json';
  link.click();

  URL.revokeObjectURL(url);
}