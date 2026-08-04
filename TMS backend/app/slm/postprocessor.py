from llama_index.core.postprocessor import SimilarityPostprocessor


class SchemaPostProcessor:

    @staticmethod
    def build():

        return [

            SimilarityPostprocessor(
                similarity_cutoff=0.45
            )

        ]