import * as core from '@actions/core'
import * as github from '@actions/github'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Initialize Octokit with given auth token
    const token = core.getInput('auth-token')
    const octokit = github.getOctokit(token)

    // Action inputs
    const includedArtifacts: string[] = parseInput('includes')
    const excludedArtifacts: string[] = parseInput('excludes')

    core.debug(`List of artifacts to include: ${includedArtifacts}`)
    core.debug(`List of artifacts to exclude: ${excludedArtifacts}`)

    // Get artifacts of the repo for the current workflow run
    const response = await octokit.rest.actions.listWorkflowRunArtifacts({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      run_id: github.context.runId
    })

    const deletedArtifacts = []
    for (const artifact of response.data.artifacts) {
      const printableArtifact: string = JSON.stringify({
        id: artifact.id,
        name: artifact.name,
        workflow_run_id: artifact.workflow_run?.id
      })
      core.debug(`Processing artifact: ${printableArtifact}`)

      const matchInclude: boolean =
        includedArtifacts.length === 0 ||
        includedArtifacts.includes(artifact.name)
      core.debug(`Artifact to include: ${matchInclude}`)

      const matchExclude: boolean =
        excludedArtifacts.length > 0 &&
        excludedArtifacts.includes(artifact.name)
      core.debug(`Artifact to exclude: ${matchExclude}`)

      if (matchInclude && !matchExclude) {
        core.info(`Deleting artifact: ${printableArtifact}`)
        await octokit.rest.actions.deleteArtifact({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          artifact_id: artifact.id
        })
        deletedArtifacts.push(artifact)
      } else {
        core.debug(`Ignore artifact: ${printableArtifact}`)
      }
    }

    core.setOutput('deleted-artifacts', deletedArtifacts)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed(JSON.stringify(error))
    }
  }
}

export function parseInput(inputName: string): string[] {
  return core
    .getInput(inputName)
    .split('\n')
    .map(element => element.trim())
    .filter(element => element.length > 0)
}
