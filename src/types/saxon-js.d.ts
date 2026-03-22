declare module 'saxon-js' {
  interface TransformOptions {
    stylesheetFileName?: string;
    stylesheetText?: string;
    stylesheetInternal?: object;
    sourceFileName?: string;
    sourceText?: string;
    sourceNode?: Node;
    destination?: 'serialized' | 'document' | 'raw' | 'application';
    [key: string]: unknown;
  }

  interface TransformResult {
    principalResult: string | Document | unknown;
    resultDocuments?: Map<string, unknown>;
    stylesheetInternal?: object;
  }

  function transform(
    options: TransformOptions,
    execution?: 'sync' | 'async',
  ): Promise<TransformResult>;

  export default {
    transform,
  };
}
