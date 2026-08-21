import type { Topic } from '@techtok/shared';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

export interface TopicMascotProps {
  topic: Topic;
  size?: number;
  opacity?: number;
}

const HEAD_CX = 100;
const HEAD_CY = 90;
const HEAD_R = 46;

interface MoleculeProps {
  cx: number;
  cy: number;
  color: string;
  scale?: number;
}

function Molecule({ cx, cy, color, scale = 1 }: MoleculeProps) {
  const d = 9 * scale;
  const r = 4 * scale;
  const midX = cx + d;
  const midY = cy - d * 0.6;
  const endX = cx + d * 1.8;
  return (
    <G opacity={0.9}>
      <Line x1={cx} y1={cy} x2={midX} y2={midY} stroke={color} strokeWidth={2} />
      <Line x1={midX} y1={midY} x2={endX} y2={cy} stroke={color} strokeWidth={2} />
      <Circle cx={cx} cy={cy} r={r} fill={color} />
      <Circle cx={midX} cy={midY} r={r} fill={color} />
      <Circle cx={endX} cy={cy} r={r} fill={color} />
    </G>
  );
}

function AiProp({ accent }: { accent: string }) {
  return (
    <G>
      <Rect
        x={158}
        y={116}
        width={30}
        height={28}
        rx={4}
        fill="#16213E"
        stroke={accent}
        strokeWidth={2}
      />
      <Line x1={163} y1={110} x2={163} y2={116} stroke={accent} strokeWidth={2} />
      <Line x1={173} y1={110} x2={173} y2={116} stroke={accent} strokeWidth={2} />
      <Line x1={183} y1={110} x2={183} y2={116} stroke={accent} strokeWidth={2} />
      <Line x1={163} y1={144} x2={163} y2={150} stroke={accent} strokeWidth={2} />
      <Line x1={173} y1={144} x2={173} y2={150} stroke={accent} strokeWidth={2} />
      <Line x1={183} y1={144} x2={183} y2={150} stroke={accent} strokeWidth={2} />
      <SvgText
        x={173}
        y={135}
        fontSize={11}
        fill={accent}
        textAnchor="middle"
        fontFamily="monospace"
      >
        AI
      </SvgText>
    </G>
  );
}

function DevProp({ accent }: { accent: string }) {
  return (
    <G>
      <Rect
        x={152}
        y={112}
        width={42}
        height={30}
        rx={3}
        fill="#16213E"
        stroke={accent}
        strokeWidth={2}
      />
      <SvgText
        x={173}
        y={132}
        fontSize={13}
        fill={accent}
        textAnchor="middle"
        fontFamily="monospace"
      >
        {'</>'}
      </SvgText>
    </G>
  );
}

function GadgetsProp({ accent }: { accent: string }) {
  return (
    <G>
      <Rect
        x={158}
        y={108}
        width={26}
        height={42}
        rx={6}
        fill="#16213E"
        stroke={accent}
        strokeWidth={2}
      />
      <Rect
        x={164}
        y={118}
        width={14}
        height={18}
        fill={accent}
        opacity={0.7}
        transform="rotate(45 171 127)"
      />
    </G>
  );
}

function StartupsProp({ accent }: { accent: string }) {
  return (
    <G transform="translate(172,128) rotate(35)">
      <Path
        d="M 0 -22 C 8 -14, 8 6, 0 16 C -8 6, -8 -14, 0 -22 Z"
        fill="#EAEAEA"
        stroke={accent}
        strokeWidth={2}
      />
      <Circle cx={0} cy={-6} r={4} fill={accent} />
      <Path d="M -5 12 L 0 22 L 5 12 Z" fill={accent} />
    </G>
  );
}

function SecurityProp({ accent }: { accent: string }) {
  return (
    <G>
      <Rect
        x={160}
        y={122}
        width={26}
        height={20}
        rx={3}
        fill="#16213E"
        stroke={accent}
        strokeWidth={2}
      />
      <Path
        d="M 165 122 L 165 114 C 165 106, 181 106, 181 114 L 181 122"
        fill="none"
        stroke={accent}
        strokeWidth={3}
      />
      <Circle cx={173} cy={132} r={3} fill={accent} />
    </G>
  );
}

function ScienceProp({ accent }: { accent: string }) {
  return (
    <G>
      <Path
        d="M 166 108 L 166 122 L 156 144 C 154 148, 157 152, 162 152 L 184 152 C 189 152, 192 148, 190 144 L 180 122 L 180 108 Z"
        fill="#16213E"
        stroke={accent}
        strokeWidth={2}
      />
      <Path
        d="M 160 144 L 186 144 L 189 148 C 189 150, 187 151, 184 151 L 162 151 C 159 151, 157 150, 157 148 Z"
        fill={accent}
        opacity={0.7}
      />
      <Line x1={165} y1={108} x2={181} y2={108} stroke={accent} strokeWidth={2} />
      <Circle cx={168} cy={138} r={2.5} fill={accent} />
      <Circle cx={176} cy={142} r={2} fill={accent} />
    </G>
  );
}

function SpaceProp({ accent }: { accent: string }) {
  return (
    <G>
      <Circle cx={172} cy={128} r={12} fill="#16213E" stroke={accent} strokeWidth={2} />
      <Ellipse
        cx={172}
        cy={128}
        rx={20}
        ry={5}
        fill="none"
        stroke={accent}
        strokeWidth={2}
        transform="rotate(-18 172 128)"
      />
    </G>
  );
}

function BioProp({ accent }: { accent: string }) {
  return (
    <G>
      <Path
        d="M 162 106 C 162 114, 182 114, 182 122 C 182 130, 162 130, 162 138 C 162 146, 182 146, 182 154"
        fill="none"
        stroke={accent}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Path
        d="M 182 106 C 182 114, 162 114, 162 122 C 162 130, 182 130, 182 138 C 182 146, 162 146, 162 154"
        fill="none"
        stroke={accent}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Line x1={166} y1={114} x2={178} y2={114} stroke={accent} strokeWidth={2} />
      <Line x1={166} y1={130} x2={178} y2={130} stroke={accent} strokeWidth={2} />
      <Line x1={166} y1={146} x2={178} y2={146} stroke={accent} strokeWidth={2} />
    </G>
  );
}

interface TopicConfig {
  accent: string;
  Prop: (props: { accent: string }) => React.JSX.Element;
}

const TOPIC_CONFIG: Record<Topic, TopicConfig> = {
  ai: { accent: '#00C2D1', Prop: AiProp },
  dev: { accent: '#2ECC71', Prop: DevProp },
  gadgets: { accent: '#4A90D9', Prop: GadgetsProp },
  startups: { accent: '#FF9F1C', Prop: StartupsProp },
  security: { accent: '#E74C3C', Prop: SecurityProp },
  science: { accent: '#9B59B6', Prop: ScienceProp },
  space: { accent: '#7C8CE0', Prop: SpaceProp },
  bio: { accent: '#16A085', Prop: BioProp },
};

export function TopicMascot({ topic, size = 200, opacity = 0.5 }: TopicMascotProps) {
  const { accent, Prop } = TOPIC_CONFIG[topic];

  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 200 220" opacity={opacity}>
      <Ellipse cx={100} cy={204} rx={34} ry={7} fill="#000" opacity={0.25} />

      <Path
        d="M 78 132 C 74 160, 68 185, 62 198 C 80 206, 120 206, 138 198 C 132 185, 126 160, 122 132 Z"
        fill="#D8CEEA"
      />
      <Path
        d="M 78 132 C 74 160, 68 185, 62 198 C 70 202, 80 204, 90 205 C 84 178, 84 152, 88 132 Z"
        fill="#A6337D"
        opacity={0.55}
      />

      <Path
        d={`M ${HEAD_CX - 18} ${HEAD_CY - 40} C ${HEAD_CX - 34} ${HEAD_CY - 58}, ${HEAD_CX - 30} ${HEAD_CY - 72}, ${HEAD_CX - 40} ${HEAD_CY - 80}`}
        fill="none"
        stroke="#2C2C3A"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Circle cx={HEAD_CX - 40} cy={HEAD_CY - 80} r={6} fill={accent} />
      <Path
        d={`M ${HEAD_CX + 16} ${HEAD_CY - 40} C ${HEAD_CX + 30} ${HEAD_CY - 56}, ${HEAD_CX + 22} ${HEAD_CY - 68}, ${HEAD_CX + 34} ${HEAD_CY - 76}`}
        fill="none"
        stroke="#2C2C3A"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Circle cx={HEAD_CX + 34} cy={HEAD_CY - 76} r={6} fill={accent} />

      <Circle cx={HEAD_CX} cy={HEAD_CY} r={HEAD_R} fill="#CFC2E8" />
      <Path
        d={`M ${HEAD_CX - 30} ${HEAD_CY - 38} C ${HEAD_CX - 48} ${HEAD_CY - 14}, ${HEAD_CX - 48} ${HEAD_CY + 14}, ${HEAD_CX - 30} ${HEAD_CY + 38} C ${HEAD_CX - 40} ${HEAD_CY + 20}, ${HEAD_CX - 40} ${HEAD_CY - 20}, ${HEAD_CX - 30} ${HEAD_CY - 38} Z`}
        fill="#A6337D"
        opacity={0.55}
      />
      <Circle cx={HEAD_CX + 10} cy={HEAD_CY} r={18} fill="#16213E" />
      <Circle cx={HEAD_CX + 16} cy={HEAD_CY - 6} r={5} fill="#fff" opacity={0.85} />

      <Path
        d="M 132 158 C 148 154, 156 148, 160 138"
        fill="none"
        stroke="#2C2C3A"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Prop accent={accent} />

      <Molecule cx={26} cy={55} color={accent} scale={0.85} />
      <Molecule cx={160} cy={193} color={accent} scale={0.7} />
    </Svg>
  );
}
