declare module 'citeproc' {
  const CSL: { Engine: new (sys: { retrieveLocale: (lang: string) => string; retrieveItem: (id: string) => unknown }, style: string, lang?: string, forceLang?: boolean) => {
    updateItems(ids: string[]): void;
    makeCitationCluster(items: { id: string }[]): string;
    makeBibliography(): [Record<string, any>, string[]] | false;
    setOutputFormat(format: string): void;
  } };
  export default CSL;
}
