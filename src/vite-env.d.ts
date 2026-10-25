/// <reference types="vite/client" />

declare module "imagetracerjs" {
  interface ImageTracerOptions {
    [key: string]: unknown;
  }
  const ImageTracer: {
    imagedataToSVG: (imgd: ImageData, options?: ImageTracerOptions) => string;
    imageToSVG: (
      url: string,
      callback: (svg: string) => void,
      options?: ImageTracerOptions,
    ) => void;
    getImgdata: (image: HTMLImageElement) => ImageData;
  };
  export default ImageTracer;
}
