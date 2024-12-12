/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */
import * as core from '@actions/core'
import * as main from '../src/main'
import { GitHub } from '@actions/github/lib/utils'

// Mock the GitHub Actions library
jest.mock('@actions/github', () => ({
  context: {
    runId: '42',
    repo: {
      owner: 'owner',
      repo: 'repo'
    }
  },
  getOctokit: jest.fn()
}))

// Mock the GitHub Actions core library
let getInputMock: jest.SpiedFunction<typeof core.getInput>

/**
 * Mock the action's inputs.
 * @param inputs - The inputs to mock.
 */
function mockInput(inputs: { [name: string]: string }): void {
  getInputMock.mockImplementation(name => {
    return inputs[name]
  })
}

describe('github action', () => {
  let octokit: InstanceType<typeof GitHub>

  beforeEach(() => {
    jest.clearAllMocks()

    jest.spyOn(core, 'debug').mockImplementation(msg => {
      console.log('[DEBUG] ', msg)
    })
    jest.spyOn(core, 'info').mockImplementation(msg => {
      console.log('[INFO] ', msg)
    })
    getInputMock = jest.spyOn(core, 'getInput').mockImplementation()

    octokit = new GitHub({ auth: 'fake-token' })
  })

  describe('deleteWorkflowArtifacts', () => {
    // Common mock data
    const mockData = {
      data: {
        artifacts: [
          {
            id: '1',
            name: 'artifact-1'
          },
          {
            id: '2',
            name: 'artifact-2'
          },
          {
            id: '3',
            name: 'artifact-3'
          }
        ]
      }
    }

    function mockListWorkflowRunArtifacts(): void {
      Object.defineProperty(octokit.rest.actions, 'listWorkflowRunArtifacts', {
        value: jest.fn().mockResolvedValue(mockData),
        writable: true
      })
    }

    function mockDeleteArtifact(): void {
      Object.defineProperty(octokit.rest.actions, 'deleteArtifact', {
        value: jest.fn().mockImplementation(),
        writable: true
      })
    }

    it('should delete all artifacts', async () => {
      //given
      mockListWorkflowRunArtifacts()
      mockDeleteArtifact()
      mockInput({ 'auth-token': 'fake-token', includes: '', excludes: '' })

      //when
      const result = await main.deleteWorkflowArtifacts(octokit)

      //then
      expect(octokit.rest.actions.listWorkflowRunArtifacts).toHaveBeenCalledTimes(1)
      expect(octokit.rest.actions.deleteArtifact).toHaveBeenCalledTimes(3)
      expect(result).toHaveLength(3)
      expect(result).toStrictEqual(mockData.data.artifacts)
    })

    it('should delete included artifacts', async () => {
      //given
      mockListWorkflowRunArtifacts()
      mockDeleteArtifact()
      const includedArtifacts = ['artifact-1', 'artifact-3'].join('\n')
      mockInput({ 'auth-token': 'fake-token', includes: includedArtifacts, excludes: '' })

      //when
      const result = await main.deleteWorkflowArtifacts(octokit)

      //then
      expect(octokit.rest.actions.listWorkflowRunArtifacts).toHaveBeenCalledTimes(1)
      expect(octokit.rest.actions.deleteArtifact).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(2)
      expect(result[0]).toBe(mockData.data.artifacts[0])
      expect(result[1]).toBe(mockData.data.artifacts[2])
    })

    it('should not delete excluded artifacts', async () => {
      //given
      mockListWorkflowRunArtifacts()
      mockDeleteArtifact()
      const excludedArtifacts = ['artifact-1', 'artifact-3'].join('\n')
      mockInput({ 'auth-token': 'fake-token', includes: '', excludes: excludedArtifacts })

      //when
      const result = await main.deleteWorkflowArtifacts(octokit)

      //then
      expect(octokit.rest.actions.listWorkflowRunArtifacts).toHaveBeenCalledTimes(1)
      expect(octokit.rest.actions.deleteArtifact).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(1)
      expect(result[0]).toBe(mockData.data.artifacts[1])
    })

    it('excludes filter should override includes filter', async () => {
      //given
      mockListWorkflowRunArtifacts()
      mockDeleteArtifact()
      const includedArtifacts = ['artifact-1', 'artifact-3'].join('\n')
      const excludedArtifacts = 'artifact-3'
      mockInput({ 'auth-token': 'fake-token', includes: includedArtifacts, excludes: excludedArtifacts })

      //when
      const result = await main.deleteWorkflowArtifacts(octokit)

      //then
      expect(octokit.rest.actions.listWorkflowRunArtifacts).toHaveBeenCalledTimes(1)
      expect(octokit.rest.actions.deleteArtifact).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(1)
      expect(result[0]).toBe(mockData.data.artifacts[0])
    })
  })

  describe('parseInput', () => {
    it('should return an array of one element and apply trim', () => {
      //given
      const inputValue = ' test1 '
      getInputMock.mockImplementation(_inputName => inputValue)

      //when
      const result = main.parseInput('')

      //then
      expect(result).toStrictEqual(['test1'])
    })

    it('should return an array of three elements and apply trim', () => {
      //given
      const inputValue = `\t test1 \n test2 \n\ntest3\t`
      getInputMock.mockImplementation(_inputName => inputValue)

      //when
      const result = main.parseInput('')

      //then
      expect(result).toStrictEqual(['test1', 'test2', 'test3'])
    })

    it('should return an empty array if no input value', () => {
      //given
      getInputMock.mockImplementation(_inputName => '')

      //when
      const result = main.parseInput('')

      //then
      expect(result).toHaveLength(0)
    })
  })
})
