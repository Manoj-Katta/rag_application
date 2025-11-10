const {PDFParse} = require('pdf-parse'); 

const loadPdf = async (documentPath) => {
    const fs = require('fs/promises'); 
    const dataBuffer = await fs.readFile(documentPath); 
    
    const res =  new PDFParse({data: dataBuffer,
        verbosity: 0});
    const data = await res.getText();
    const metaData = await res.getInfo();
    const pages = await metaData.total;
    return {
        rawText: data,
        totalPages: pages
    };
};

module.exports = { loadPdf };
