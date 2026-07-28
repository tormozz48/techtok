import { act, create } from 'react-test-renderer';
import { gradientForPostId, hashToIndex, ImageStub } from './ImageStub';

// react-test-renderer's `create` schedules the initial render as a regular
// React update; without `act(...)` it commits asynchronously (after this
// test has already finished), so `.toJSON()` sees an empty tree. Wrapping in
// `act` forces the render to flush synchronously before we inspect it.
function renderStub(props: Parameters<typeof ImageStub>[0]) {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(<ImageStub {...props} />);
  });
  if (!tree) throw new Error('renderer.create did not produce a tree');
  return tree.toJSON();
}

describe('hashToIndex', () => {
  it('is deterministic for the same input', () => {
    expect(hashToIndex('abc123', 8)).toBe(hashToIndex('abc123', 8));
  });

  it('stays within [0, modulus)', () => {
    const ids = ['a', 'post-1', 'a'.repeat(64), '0000000000000000000000000000000000000000'];
    for (const id of ids) {
      const index = hashToIndex(id, 8);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(8);
    }
  });

  it('spreads different inputs across different buckets', () => {
    const indexes = new Set(
      ['post-1', 'post-2', 'post-3', 'post-4', 'post-5', 'post-6'].map((id) => hashToIndex(id, 8)),
    );
    expect(indexes.size).toBeGreaterThan(1);
  });
});

describe('gradientForPostId', () => {
  it('returns the same gradient pair for the same postId every time', () => {
    const postId = 'a'.repeat(64);
    expect(gradientForPostId(postId)).toEqual(gradientForPostId(postId));
  });

  it('returns a two-color pair', () => {
    const [start, end] = gradientForPostId('some-post-id');
    expect(typeof start).toBe('string');
    expect(typeof end).toBe('string');
    expect(start).not.toBe(end);
  });
});

describe('ImageStub', () => {
  it('renders a deterministic gradient + topic mascot (snapshot)', () => {
    const tree = renderStub({ postId: 'abc123deadbeef', topic: 'ai' });
    expect(tree).toMatchSnapshot();
  });

  it('renders a different topic with a different mascot (snapshot)', () => {
    const tree = renderStub({ postId: 'abc123deadbeef', topic: 'space' });
    expect(tree).toMatchSnapshot();
  });
});
