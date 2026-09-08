export interface PdfPageImageGateway {
  open(uri: string): Promise<{ readonly pageCount: number }>;
  generate(
    uri: string,
    page: number,
    scale: number,
    options: {
      readonly format: 'jpeg';
      readonly quality: number;
      readonly maxDimension: number;
    },
  ): Promise<{
    readonly uri: string;
    readonly width: number;
    readonly height: number;
  }>;
  close(uri: string): Promise<void>;
}

export type PdfPageImageGatewayLoader = () => Promise<PdfPageImageGateway>;

export async function loadNativePdfPageImageGateway(): Promise<PdfPageImageGateway> {
  const { PdfPageImage } = await import('@dariyd/react-native-pdf-page-image');
  return PdfPageImage;
}
