import { render } from '@testing-library/react-native';
import { ImageSkeleton } from './ImageSkeleton';

describe('ImageSkeleton', () => {
  it('renders the pulsing placeholder without crashing', async () => {
    const { toJSON } = await render(<ImageSkeleton />);
    expect(toJSON()).toBeTruthy();
  });
});
