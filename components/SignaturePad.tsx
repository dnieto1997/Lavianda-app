import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet } from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';

interface SignaturePadProps {
  onOK: (signature: string) => void;
  onEmpty?: () => void;
  onClear?: () => void;
  onBegin?: () => void;
  onEnd?: () => void;
  descriptionText?: string;
  clearText?: string;
  confirmText?: string;
  webStyle?: string;
  autoClear?: boolean;
  imageType?: 'image/png' | 'image/jpeg' | 'image/svg+xml';
  dataURL?: string;
  penColor?: string;
  backgroundColor?: string;
  dotSize?: number;
  minWidth?: number;
  maxWidth?: number;
}

export interface SignaturePadRef {
  clearSignature: () => void;
  readSignature: () => void;
  changePenColor: (color: string) => void;
  changePenSize: (minWidth: number, maxWidth: number) => void;
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  (
    {
      onOK,
      onEmpty,
      onClear,
      onBegin,
      onEnd,
      descriptionText = 'Firme aquí',
      clearText = 'Limpiar',
      confirmText = 'Confirmar',
      webStyle,
      autoClear = false,
      imageType = 'image/png',
      dataURL,
      penColor = '#000000',
      backgroundColor = 'transparent',
      dotSize = 0,
      minWidth = 0.5,
      maxWidth = 2.5,
    },
    ref
  ) => {
    const signatureRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      clearSignature: () => {
        signatureRef.current?.clearSignature();
      },
      readSignature: () => {
        signatureRef.current?.readSignature();
      },
      changePenColor: (color: string) => {
        signatureRef.current?.changePenColor(color);
      },
      changePenSize: (min: number, max: number) => {
        signatureRef.current?.changePenSize(min, max);
      },
    }));

    const handleOK = (signature: string) => {
      console.log('✍️ Firma capturada en SignaturePad:', signature.substring(0, 50));
      onOK(signature);
    };

    const handleEmpty = () => {
      console.log('⚠️ Firma vacía');
      if (onEmpty) onEmpty();
    };

    const handleClear = () => {
      console.log('🧹 Firma limpiada');
      if (onClear) onClear();
    };

    const handleBegin = () => {
      console.log('🖊️ Comenzó a firmar');
      if (onBegin) onBegin();
    };

    const handleEnd = () => {
      console.log('✅ Terminó de firmar');
      if (onEnd) onEnd();
    };

    // Estilo por defecto si no se proporciona uno
    const defaultWebStyle = `.m-signature-pad {
      box-shadow: none;
      border: none;
      margin: 0;
    }
    .m-signature-pad--body {
      border: none;
      margin: 0;
    }
    .m-signature-pad--footer {
      display: none;
      margin: 0;
    }
    body,html {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
    }`;

    return (
      <View style={styles.container}>
        <SignatureCanvas
          ref={signatureRef}
          onOK={handleOK}
          onEmpty={handleEmpty}
          onClear={handleClear}
          onBegin={handleBegin}
          onEnd={handleEnd}
          descriptionText={descriptionText}
          clearText={clearText}
          confirmText={confirmText}
          webStyle={webStyle || defaultWebStyle}
          autoClear={autoClear}
          imageType={imageType}
          dataURL={dataURL}
          penColor={penColor}
          backgroundColor={backgroundColor}
          dotSize={dotSize}
          minWidth={minWidth}
          maxWidth={maxWidth}
        />
      </View>
    );
  }
);

SignaturePad.displayName = 'SignaturePad';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

export default SignaturePad;
