
# contextflow/core/tree_logic.py
from typing import List, Dict, Any, Optional

class TreeNode:
    """Representa um arquivo ou diretório na estrutura do projeto."""
    
    def __init__(self, name: str, full_path: str, is_dir: bool, size_bytes: int = 0, is_text: bool = False, token_count: int = 0):
        self.name: str = name
        self.full_path: str = full_path 
        self.is_dir: bool = is_dir
        self.size_bytes: int = size_bytes
        self.is_text: bool = is_text
        self.token_count: int = token_count
        
        self.children: List['TreeNode'] = []
        self.parent: Optional['TreeNode'] = None
        
        # 0: Não selecionado, 1: Parcialmente selecionado, 2: Totalmente selecionado (Logica original UI)
        self.selection_state: int = 0 
        self.total_recursive_tokens: int = 0

    def add_child(self, child: 'TreeNode'):
        self.children.append(child)
        child.parent = self

    def calculate_recursive_tokens(self) -> int:
        """Calcula e atualiza o total de tokens do nó e seus filhos."""
        total_tokens = self.token_count if not self.is_dir and self.is_text else 0
        for child in self.children:
            total_tokens += child.calculate_recursive_tokens()
        self.total_recursive_tokens = total_tokens
        return total_tokens

    def __repr__(self) -> str:
        return f"TreeNode(name='{self.name}', path='{self.full_path}', dir={self.is_dir})"
