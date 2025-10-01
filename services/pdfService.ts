// --- START OF FILE services/pdfService.ts (Servicio PDF Completo) ---

import { Platform } from 'react-native';

// --- Interfaces ---
export interface FormularioData {
  id: number;
  empresa_nombre: string;
  usuario_nombre: string;
  fecha_creacion: string;
  ubicacion?: string;
  observaciones?: string;
  estado?: string;
  
  // Campos dinámicos del formulario
  [key: string]: any;
}

export interface PDFConfig {
  title?: string;
  includeHeader?: boolean;
  includeFooter?: boolean;
  logoUrl?: string;
  companyName?: string;
  format?: 'A4' | 'Letter';
}

// --- Configuración por defecto ---
const DEFAULT_CONFIG: PDFConfig = {
  title: 'Formulario de Acta de Inicio',
  includeHeader: true,
  includeFooter: true,
  companyName: 'La Vianda - Operaciones',
  format: 'A4',
};

// --- Utilidades de Formateo ---
export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return dateString;
  }
};

export const formatFieldName = (fieldName: string): string => {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
};

export const formatFieldValue = (value: any): string => {
  if (value === null || value === undefined) return 'No especificado';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

// --- Generación de HTML ---
export const generatePDFHTML = (data: FormularioData, config: PDFConfig = {}): string => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Campos especiales que no queremos mostrar en el contenido principal
  const excludeFields = ['id', 'created_at', 'updated_at', 'empresa_id', 'user_id'];
  
  // Obtener todos los campos del formulario
  const formFields = Object.entries(data)
    .filter(([key, value]) => !excludeFields.includes(key) && value !== null && value !== undefined)
    .map(([key, value]) => ({
      name: formatFieldName(key),
      value: formatFieldValue(value),
      originalKey: key,
    }));

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${finalConfig.title}</title>
    <style>
        @page {
            size: ${finalConfig.format};
            margin: 2cm;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
        }
        
        .container {
            max-width: 100%;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            border-bottom: 3px solid #C62828;
            padding-bottom: 20px;
            margin-bottom: 30px;
            text-align: center;
        }
        
        .header h1 {
            color: #C62828;
            font-size: 24px;
            margin-bottom: 10px;
            font-weight: bold;
        }
        
        .header .company {
            color: #666;
            font-size: 16px;
            margin-bottom: 5px;
        }
        
        .header .date {
            color: #888;
            font-size: 14px;
        }
        
        .info-section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            border-left: 4px solid #C62828;
        }
        
        .info-section h2 {
            color: #C62828;
            font-size: 18px;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
        }
        
        .info-section h2:before {
            content: "📋";
            margin-right: 10px;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
        }
        
        .info-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #e0e0e0;
        }
        
        .info-item .label {
            font-weight: bold;
            color: #555;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        
        .info-item .value {
            color: #333;
            font-size: 15px;
            word-wrap: break-word;
        }
        
        .content-section {
            margin-bottom: 30px;
        }
        
        .content-section h2 {
            color: #C62828;
            font-size: 18px;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e0e0e0;
            display: flex;
            align-items: center;
        }
        
        .content-section h2:before {
            content: "📝";
            margin-right: 10px;
        }
        
        .field-row {
            display: flex;
            padding: 12px 0;
            border-bottom: 1px solid #f0f0f0;
            align-items: flex-start;
        }
        
        .field-row:last-child {
            border-bottom: none;
        }
        
        .field-row:nth-child(even) {
            background: #fafafa;
            margin: 0 -15px;
            padding: 12px 15px;
        }
        
        .field-name {
            font-weight: 600;
            color: #555;
            min-width: 180px;
            flex-shrink: 0;
            font-size: 14px;
        }
        
        .field-value {
            color: #333;
            flex: 1;
            font-size: 14px;
            word-wrap: break-word;
        }
        
        .field-value.boolean-yes {
            color: #4CAF50;
            font-weight: 600;
        }
        
        .field-value.boolean-no {
            color: #F44336;
            font-weight: 600;
        }
        
        .field-value.highlight {
            background: #fff3cd;
            padding: 4px 8px;
            border-radius: 4px;
            border-left: 3px solid #ffc107;
        }
        
        .observations {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
            border-left: 4px solid #17a2b8;
        }
        
        .observations h3 {
            color: #17a2b8;
            margin-bottom: 10px;
            font-size: 16px;
        }
        
        .observations p {
            color: #555;
            font-style: italic;
            line-height: 1.6;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        
        .footer .generated {
            margin-bottom: 10px;
        }
        
        .footer .company-info {
            font-weight: bold;
            color: #C62828;
        }
        
        .signature-section {
            margin-top: 40px;
            padding: 20px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
        }
        
        .signature-section h3 {
            text-align: center;
            color: #555;
            margin-bottom: 30px;
        }
        
        .signature-boxes {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
        }
        
        .signature-box {
            text-align: center;
        }
        
        .signature-line {
            border-bottom: 2px solid #333;
            height: 60px;
            margin-bottom: 10px;
        }
        
        .signature-label {
            font-weight: bold;
            color: #555;
        }
        
        @media print {
            .container {
                padding: 0;
            }
            
            .header {
                margin-bottom: 20px;
            }
            
            .content-section {
                margin-bottom: 20px;
            }
            
            .signature-section {
                page-break-inside: avoid;
                margin-top: 30px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        ${finalConfig.includeHeader ? `
        <div class="header">
            <h1>${finalConfig.title}</h1>
            <div class="company">${finalConfig.companyName}</div>
            <div class="date">Generado el ${formatDate(new Date().toISOString())}</div>
        </div>
        ` : ''}
        
        <div class="info-section">
            <h2>Información General</h2>
            <div class="info-grid">
                <div class="info-item">
                    <div class="label">ID Formulario</div>
                    <div class="value">#${data.id || 'N/A'}</div>
                </div>
                <div class="info-item">
                    <div class="label">Empresa</div>
                    <div class="value">${data.empresa_nombre || 'No especificada'}</div>
                </div>
                <div class="info-item">
                    <div class="label">Usuario</div>
                    <div class="value">${data.usuario_nombre || 'No especificado'}</div>
                </div>
                <div class="info-item">
                    <div class="label">Fecha de Creación</div>
                    <div class="value">${formatDate(data.fecha_creacion || '')}</div>
                </div>
                ${data.ubicacion ? `
                <div class="info-item">
                    <div class="label">Ubicación</div>
                    <div class="value">${data.ubicacion}</div>
                </div>
                ` : ''}
                ${data.estado ? `
                <div class="info-item">
                    <div class="label">Estado</div>
                    <div class="value">${data.estado}</div>
                </div>
                ` : ''}
            </div>
        </div>
        
        <div class="content-section">
            <h2>Contenido del Formulario</h2>
            ${formFields.map(field => {
              let valueClass = '';
              let value = field.value;
              
              // Aplicar clases especiales para valores booleanos
              if (value === 'Sí') valueClass = 'boolean-yes';
              else if (value === 'No') valueClass = 'boolean-no';
              
              // Destacar campos importantes
              if (field.originalKey.toLowerCase().includes('observacion') || 
                  field.originalKey.toLowerCase().includes('comentario') ||
                  field.originalKey.toLowerCase().includes('nota')) {
                valueClass += ' highlight';
              }
              
              return `
                <div class="field-row">
                    <div class="field-name">${field.name}:</div>
                    <div class="field-value ${valueClass}">${value}</div>
                </div>
              `;
            }).join('')}
        </div>
        
        ${data.observaciones ? `
        <div class="observations">
            <h3>💬 Observaciones Adicionales</h3>
            <p>${data.observaciones}</p>
        </div>
        ` : ''}
        
        <div class="signature-section">
            <h3>FIRMAS Y AUTORIZACIÓN</h3>
            <div class="signature-boxes">
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <div class="signature-label">Firma del Responsable</div>
                </div>
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <div class="signature-label">Firma del Supervisor</div>
                </div>
            </div>
        </div>
        
        ${finalConfig.includeFooter ? `
        <div class="footer">
            <div class="generated">Documento generado automáticamente el ${formatDate(new Date().toISOString())}</div>
            <div class="company-info">${finalConfig.companyName}</div>
        </div>
        ` : ''}
    </div>
</body>
</html>
  `;

  return html;
};

// --- Funciones principales del servicio ---

/**
 * Genera un PDF para web usando la API de impresión del navegador
 */
export const generatePDFWeb = async (
  data: FormularioData,
  config: PDFConfig = {}
): Promise<void> => {
  try {
    const html = generatePDFHTML(data, config);
    
    // Crear una nueva ventana para imprimir
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('No se pudo abrir la ventana de impresión');
    }

    printWindow.document.write(html);
    printWindow.document.close();

    // Esperar a que se cargue completamente
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        // Opcional: cerrar la ventana después de imprimir
        // printWindow.close();
      }, 250);
    };

    console.log('✅ PDF generado exitosamente para web');
  } catch (error) {
    console.error('❌ Error al generar PDF para web:', error);
    throw error;
  }
};

/**
 * Genera un PDF para móvil (requiere implementación adicional)
 */
export const generatePDFMobile = async (
  data: FormularioData,
  config: PDFConfig = {}
): Promise<string> => {
  try {
    console.log('📱 Generando PDF para móvil...');
    
    // Para React Native necesitaríamos una librería como react-native-html-to-pdf
    // Por ahora devolvemos el HTML que se puede usar con una librería externa
    const html = generatePDFHTML(data, config);
    
    // TODO: Implementar generación nativa para móvil
    // Esto requeriría instalar react-native-html-to-pdf o similar
    
    console.log('⚠️ Generación de PDF nativo pendiente de implementación');
    return html;
  } catch (error) {
    console.error('❌ Error al generar PDF para móvil:', error);
    throw error;
  }
};

/**
 * Función principal que detecta la plataforma y usa el método apropiado
 */
export const generatePDF = async (
  data: FormularioData,
  config: PDFConfig = {}
): Promise<void | string> => {
  try {
    console.log('📄 Iniciando generación de PDF...');
    console.log('📊 Datos recibidos:', { 
      id: data.id, 
      empresa: data.empresa_nombre,
      campos: Object.keys(data).length 
    });

    if (Platform.OS === 'web') {
      await generatePDFWeb(data, config);
      return;
    } else {
      return await generatePDFMobile(data, config);
    }
  } catch (error) {
    console.error('❌ Error en generatePDF:', error);
    throw new Error(`Error al generar PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
};

/**
 * Función para previsualizar el HTML del PDF (útil para debugging)
 */
export const previewPDFHTML = (data: FormularioData, config: PDFConfig = {}): string => {
  return generatePDFHTML(data, config);
};

/**
 * Función para validar los datos antes de generar el PDF
 */
export const validatePDFData = (data: FormularioData): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.id) errors.push('ID del formulario es requerido');
  if (!data.empresa_nombre) errors.push('Nombre de empresa es requerido');
  if (!data.usuario_nombre) errors.push('Nombre de usuario es requerido');
  if (!data.fecha_creacion) errors.push('Fecha de creación es requerida');

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// --- Exportaciones ---
export default {
  generatePDF,
  generatePDFWeb,
  generatePDFMobile,
  generatePDFHTML,
  previewPDFHTML,
  validatePDFData,
  formatDate,
  formatFieldName,
  formatFieldValue,
};

// --- END OF FILE ---
