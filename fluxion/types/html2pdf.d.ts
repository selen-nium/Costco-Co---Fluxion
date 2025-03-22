declare module 'html2pdf.js' {
    function html2pdf(): html2pdf.Html2PdfInstance;
    
    namespace html2pdf {
      interface Html2PdfInstance {
        from(element: HTMLElement): Html2PdfInstance;
        set(options: any): Html2PdfInstance;
        save(): Promise<void>;
      }
    }
    
    export = html2pdf;
  }