import { gql } from '@apollo/client';

export const GET_RANDOM_RIDDLE = gql`
  query GetRandomRiddle {
    randomRiddle {
      id
      question
      solved
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
      }
    }
  }
`;
