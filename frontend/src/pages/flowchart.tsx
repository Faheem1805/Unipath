import { useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type NodeProps,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Search, GitBranch, MousePointer2, X } from 'lucide-react';
import { prerequisiteChain, references, type Course, type CourseState } from '@unipath/shared';
import { useAcademic } from '../lib/store';
import { PageTitle, Status, StateIcon, stateLabels } from '../components/common';
import { CourseDetail } from '../components/course-detail';
type CourseNode = Node<
  { course: Course; state: CourseState; dimmed: boolean; highlighted: boolean },
  'course'
>;
function CourseCard({ data }: NodeProps<CourseNode>) {
  return (
    <div
      className={`flow-course flow-${data.state} ${data.dimmed ? 'flow-dimmed' : ''} ${data.highlighted ? 'flow-highlighted' : ''}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flow-code">
        <span>{data.course.code}</span>
        <StateIcon state={data.state} />
      </div>
      <strong>{data.course.title}</strong>
      <div className="flow-bottom">
        <span>{data.course.credits} credits</span>
        <span>{stateLabels[data.state]}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { course: CourseCard };
const colors = {
  completed: '#349181',
  taking: '#5288c9',
  eligible: '#ba922e',
  locked: '#aaaeb5',
  unplanned: '#c6c9cd',
};
export function Flowchart() {
  const { curriculum, stats } = useAcademic();
  const [search, setSearch] = useState('');
  const [chain, setChain] = useState<Course | null>(null);
  const [detail, setDetail] = useState<Course | null>(null);
  const [filter, setFilter] = useState('all');
  const highlighted = useMemo(
    () => (chain ? prerequisiteChain(chain, curriculum) : null),
    [chain, curriculum],
  );
  const nodes = useMemo<Node[]>(() => {
    const counts: Record<number, number> = {};
    return curriculum.courses.map((c) => {
      const row = counts[c.semester] ?? 0;
      counts[c.semester] = row + 1;
      return {
        id: c.code,
        type: 'course',
        position: { x: (c.semester - 1) * 295, y: row * 144 },
        data: {
          course: c,
          state: stats.states[c.code].state,
          highlighted: highlighted?.has(c.code) ?? false,
          dimmed:
            (!!highlighted && !highlighted.has(c.code)) ||
            (filter !== 'all' && stats.states[c.code].state !== filter) ||
            (!!search && !`${c.code} ${c.title}`.toLowerCase().includes(search.toLowerCase())),
        },
        ariaLabel: `${c.code} ${c.title}, ${stateLabels[stats.states[c.code].state]}`,
      };
    });
  }, [curriculum, stats, highlighted, search, filter]);
  const edges = useMemo<Edge[]>(
    () =>
      curriculum.courses.flatMap((c) =>
        references(c.requirement).map((ref) => ({
          id: `${ref}-${c.code}`,
          source: ref,
          target: c.code,
          animated: highlighted?.has(ref) && highlighted.has(c.code),
          style: {
            stroke: highlighted?.has(ref) && highlighted.has(c.code) ? '#168074' : '#bfc8c7',
            strokeWidth: highlighted?.has(ref) && highlighted.has(c.code) ? 2.5 : 1.3,
            opacity: highlighted && !highlighted.has(c.code) ? 0.12 : 0.6,
          },
        })),
      ),
    [curriculum, highlighted],
  );
  return (
    <>
      <PageTitle
        eyebrow="SEE HOW IT ALL CONNECTS"
        title="Your degree, mapped out."
        description="Explore the connections. Select a course to trace its prerequisites; open it to update your progress."
      />
      <section className="panel flow-panel">
        <div className="flow-toolbar">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search degree map"
              placeholder="Find a course or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter course status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All course states</option>
            {Object.entries(stateLabels).map(([state, label]) => (
              <option key={state} value={state}>
                {label}
              </option>
            ))}
          </select>
          <div className="flow-hint">
            <MousePointer2 size={14} /> Scroll to zoom · Drag to pan
          </div>
        </div>
        <div className="semester-strip">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i}>
              SEMESTER {i + 1}
              <small>Year {Math.floor(i / 2) + 1}</small>
            </span>
          ))}
        </div>
        <div className="flow-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.2}
            maxZoom={1.6}
            nodesDraggable={false}
            nodesConnectable={false}
            onNodeClick={(_e, node) =>
              setChain(curriculum.courses.find((c) => c.code === node.id) ?? null)
            }
            onNodeDoubleClick={(_e, node) =>
              setDetail(curriculum.courses.find((c) => c.code === node.id) ?? null)
            }
            onPaneClick={() => setChain(null)}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(n) => colors[(n.data as CourseNode['data']).state]}
              pannable
              zoomable
            />
          </ReactFlow>
        </div>
        <div className="flow-legend">
          {Object.keys(stateLabels).map((state) => (
            <Status state={state as CourseState} key={state} />
          ))}
          <span>Elective alternatives appear together; complete only the group requirement.</span>
        </div>
      </section>
      {chain && (
        <div className="selected-course-bar">
          <GitBranch size={20} />
          <div>
            <strong>
              {chain.code} · {chain.title}
            </strong>
            <span>{highlighted!.size - 1} connected prerequisite courses highlighted</span>
          </div>
          <button className="text-button" onClick={() => setDetail(chain)}>
            View course & update progress →
          </button>
          <button
            className="icon-button"
            aria-label="Clear course selection"
            onClick={() => setChain(null)}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <p className="fine-print">
        Lines show all possible prerequisite paths, including OR alternatives and corequisites. Open
        a course for the exact rule. Suggested semesters are a guide, not confirmed offerings.
      </p>
      <CourseDetail course={detail} onClose={() => setDetail(null)} />
    </>
  );
}
