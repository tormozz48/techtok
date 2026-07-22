import { act, create } from 'react-test-renderer';
import { LoadingScreen } from './LoadingScreen';

describe('LoadingScreen', () => {
  it('renders the branded logo + spinner without crashing (snapshot)', () => {
    let tree: ReturnType<typeof create> | undefined;
    act(() => {
      tree = create(<LoadingScreen />);
    });
    expect(tree?.toJSON()).toMatchSnapshot();
  });
});
