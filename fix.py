import codecs

def filter_schema():
    with codecs.open('c:/peaceCars/backend/supabase_schema.sql', 'r', 'utf-16le') as f:
        content = f.read()

    blocks = content.split('\n\n-- ')

    filtered_blocks = []
    for i, block in enumerate(blocks):
        text_to_check = block if i == 0 else '-- ' + block
        lower_text = text_to_check.lower()
        
        is_auth_block = False
        
        if '"auth".' in text_to_check or 'schema if not exists "auth"' in lower_text:
            if 'create type "auth".' in lower_text or \
               'create table "auth".' in lower_text or \
               ('create index ' in lower_text and ' on "auth".' in lower_text) or \
               ('create unique index ' in lower_text and ' on "auth".' in lower_text) or \
               'alter table "auth".' in lower_text or \
               'create schema if not exists "auth"' in lower_text:
                is_auth_block = True

        if not is_auth_block:
            filtered_blocks.append(text_to_check)

    final_content = '\n\n'.join(filtered_blocks)

    with codecs.open('c:/peaceCars/backend/supabase_schema.sql', 'w', 'utf-16le') as f:
        f.write(final_content)

if __name__ == '__main__':
    filter_schema()
