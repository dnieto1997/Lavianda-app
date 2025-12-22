import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  Text,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { EvilIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface Point {
  x: number;
  y: number;
}

interface PathData {
  points: Point[];
  pathString: string;
}

interface SimpleSignaturePadProps {
  onPathsChange?: (paths: PathData[]) => void;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

export const SimpleSignaturePad = React.forwardRef<any, SimpleSignaturePadProps>(
  ({ onPathsChange, height = 300, strokeColor = '#000', strokeWidth = 3 }, ref) => {
    const [paths, setPaths] = useState<PathData[]>([]);
    const currentPath = useRef<Point[]>([]);

    React.useImperativeHandle(ref, () => ({
      clear: () => {
        setPaths([]);
        currentPath.current = [];
        onPathsChange?.([]);
      },
      getPaths: () => paths,
      isEmpty: () => paths.length === 0,
      toDataURL: () => {
        const svgPaths = paths.map(p => p.pathString).join(' ');
        const svg = `<svg width="${width - 40}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <path d="${svgPaths}" stroke="${strokeColor}" strokeWidth="${strokeWidth}" fill="none" />
        </svg>`;
        return `data:image/svg+xml;base64,${btoa(svg)}`;
      },
    }));

    const pointsToSvgPath = (points: Point[]): string => {
      if (points.length === 0) return '';
      let path = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i].x} ${points[i].y}`;
      }
      return path;
    };

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          currentPath.current = [{ x: locationX, y: locationY }];
          const newPath: PathData = {
            points: [{ x: locationX, y: locationY }],
            pathString: pointsToSvgPath([{ x: locationX, y: locationY }]),
          };
          setPaths(prevPaths => [...prevPaths, newPath]);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          currentPath.current.push({ x: locationX, y: locationY });
          const updatedPath: PathData = {
            points: [...currentPath.current],
            pathString: pointsToSvgPath(currentPath.current),
          };
          setPaths(prevPaths => [...prevPaths.slice(0, -1), updatedPath]);
        },
        onPanResponderRelease: () => {
          currentPath.current = [];
        },
      })
    ).current;

    // 👇 Aquí agregamos el botón de borrar
    return (
      <View style={styles.container}>
        <View style={[styles.canvas, { height, width: width - 40 }]} {...panResponder.panHandlers}>
          <Svg height={height} width={width - 40} style={styles.svg}>
            {paths.map((pathData, index) => (
              <Path
                key={index}
                d={pathData.pathString}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
        </View>

        {/* 🗑️ Botón borrar firma */}
         <TouchableOpacity
          style={styles.clearButton}
          onPress={() => {
            setPaths([]);
            currentPath.current = [];
            onPathsChange?.([]);
          }}
        >
          <EvilIcons name="trash" size={28} color="#fff" />
          <Text style={styles.clearButtonText}>Borrar firma</Text>
        </TouchableOpacity>
      </View>
    );
  }
);


const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  svg: {
    backgroundColor: 'transparent',
  },

 
  clearButton: {
    flexDirection: 'row', // 👈 icono + texto
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: '#ff4d4d',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4,
    fontSize: 16,
  },
});

export default SimpleSignaturePad;
