/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TextInput } from 'react-native';
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';
import App from '../App';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

afterEach(() => jest.restoreAllMocks());

test('signs in, answers a question and clears an expired session', async () => {
  const response = (data: object, status = 200) => ({
    ok: status < 400, status, json: async () => data,
  } as Response);
  const fetchMock = jest.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(response({ message: 'Your verification code is available in the server console.' }))
    .mockResolvedValueOnce(response({ token: 'token', user: { email: 'student@example.com' }, expiresAt: 123 }))
    .mockResolvedValueOnce(response([{ name: 'Anatomy', questionCount: 1 }]))
    .mockResolvedValueOnce(response([{ id: 'q1', version: 1, chapter: 'Anatomy', stem: 'Question?', options: ['A', 'B', 'C', 'D'] }]))
    .mockResolvedValueOnce(response({ correct: 0, explanation: 'Explanation', isCorrect: true }))
    .mockResolvedValueOnce(response({ error: 'Sign in again.' }, 401));
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  const input = (label: string) => renderer!.root.findAllByType(TextInput).find(item => item.props.accessibilityLabel === label)!;
  const button = (label: string) => renderer!.root.findAll(item => item.props.accessibilityRole === 'button' && item.findAllByProps({ children: label }).length > 0)[0];
  await ReactTestRenderer.act(() => { input('Email').props.onChangeText('student@example.com'); });
  await ReactTestRenderer.act(async () => { await button('Request code').props.onPress(); });
  await ReactTestRenderer.act(() => { input('Six-digit code').props.onChangeText('123456'); });
  await ReactTestRenderer.act(async () => { await button('Sign in').props.onPress(); });
  await ReactTestRenderer.act(async () => { await button('Anatomy').props.onPress(); });
  const option = renderer!.root.findAll(item => item.props.accessibilityRole === 'radio')[0];
  await ReactTestRenderer.act(() => { option.props.onPress(); });
  await ReactTestRenderer.act(async () => { await button('Submit answer').props.onPress(); });
  expect(renderer!.root.findAllByProps({ children: 'Explanation' }).length).toBeGreaterThan(0);
  await ReactTestRenderer.act(() => { input('Question report').props.onChangeText('Please review'); });
  await ReactTestRenderer.act(async () => { await button('Send report').props.onPress(); });
  expect(input('Email')).toBeTruthy();
  expect(renderer!.root.findAllByProps({ children: 'Sign in again.' }).length).toBeGreaterThan(0);
  expect(fetchMock).toHaveBeenCalledTimes(6);
});
