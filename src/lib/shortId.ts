// The short, human-friendly drive ID: the first 8 characters of the job's
// full ID, upper-cased (e.g. D26B3934). It's only a display/lookup form - the
// full ID is still what the database uses - and the admin lookup accepts it.
export function shortJobId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase()
}
