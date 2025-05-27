import { gql } from '@apollo/client';

export const GET_RANDOM_RIDDLE = gql`
  query GetRandomRiddle {
    randomRiddle {
      id
      question
      solved
      onchain
    }
  }
`;

export const GET_RIDDLE = gql`
  query GetRiddle($id: ID!) {
    riddle(id: $id) {
      id
      question
      solved
      answer
    }
  }
`;

export const CHECK_ANSWER = gql`
  mutation CheckAnswer($id: ID!, $answer: String!, $playerId: String!) {
    checkAnswer(id: $id, answer: $answer, playerId: $playerId)
  }
`;

export const PREPARE_METAMASK_TRANSACTION = gql`
  query PrepareMetaMaskTransaction($answer: String!) {
    prepareMetaMaskTransaction(answer: $answer) {
      to
      data
      chainId
    }
  }
`;

export const RIDDLE_SOLVED_SUBSCRIPTION = gql`
  subscription OnRiddleSolved {
    riddleSolved {
      solvedBy
      newRiddle {
        id
        question
        solved
        onchain
      }
    }
  }
`;

export const SET_RANDOM_RIDDLE_ONCHAIN = gql`
  mutation SetRandomRiddleOnchain {
    setRandomRiddleOnchain
  }
`;

export const SET_SPECIFIC_RIDDLE_ONCHAIN = gql`
  mutation SetSpecificRiddleOnchain($index: Float!) {
    setSpecificRiddleOnchain(index: $index)
  }
`;

export const RESET_GAME = gql`
  mutation ResetGame {
    resetGame
  }
`;
